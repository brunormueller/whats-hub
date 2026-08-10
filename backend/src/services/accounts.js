/**
 * Contas do produto: cadastro, login e o vínculo entre a conta e a instância
 * de WhatsApp dela.
 *
 * Uma conta = um tenant. Os dados de atendimento ficam sob `t:<id>:` (ver
 * redis.js); aqui vive só o cadastro.
 *
 * Senha: scrypt com salt aleatório por conta. Sem dependência externa — o
 * `crypto` do Node já traz a KDF, e o formato guardado carrega os parâmetros,
 * então dá para endurecer o custo depois sem invalidar as senhas antigas.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import redis, { adoptLegacyData, hasLegacyData } from './redis.js';

const scrypt = promisify(scryptCb);

const ACCOUNT_KEY = (id) => `account:${id}`;
const BY_EMAIL_KEY = 'accounts:byEmail';
const BY_INSTANCE_KEY = 'accounts:byInstance';
const IDS_KEY = 'accounts:ids';

// custo do scrypt: N=32768, r=8, p=1 (~33 MB por verificação)
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

export const MIN_PASSWORD = 8;

/* ------------------------------------------------------------------ *
 * Senha
 * ------------------------------------------------------------------ */

async function derive(password, salt, params = SCRYPT) {
  return scrypt(password, salt, params.keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: params.maxmem,
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Comparação em tempo constante — não vaza o prefixo correto do hash. */
export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, N, r, p, saltHex, hashHex] = parts;
  const expected = Buffer.from(hashHex, 'hex');

  const actual = await derive(password, Buffer.from(saltHex, 'hex'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    keylen: expected.length,
    maxmem: SCRYPT.maxmem,
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* ------------------------------------------------------------------ *
 * Validação e leitura
 * ------------------------------------------------------------------ */

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Erro de entrada do usuário — a rota devolve 400 com esta mensagem. */
export class AccountError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function parse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getAccount(id) {
  if (!id) return null;
  return parse(await redis.get(ACCOUNT_KEY(id)));
}

export async function findByEmail(email) {
  const id = await redis.hget(BY_EMAIL_KEY, normalizeEmail(email));
  return id ? getAccount(id) : null;
}

/** Qual conta é dona de uma instância da Evolution (usado pelo webhook). */
export async function findByInstance(instanceName) {
  if (!instanceName) return null;
  const id = await redis.hget(BY_INSTANCE_KEY, instanceName);
  return id ? getAccount(id) : null;
}

export async function countAccounts() {
  return redis.scard(IDS_KEY);
}

/** Ids de todas as contas — usado pelas migrações de boot. */
export async function listAccountIds() {
  return redis.smembers(IDS_KEY);
}

/** Sem dados sensíveis: é isso que vai para o front. */
export function publicAccount(account) {
  if (!account) return null;
  const { passwordHash, ...rest } = account;
  return rest;
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

/**
 * Nome de instância da versão single-tenant (`EVOLUTION_INSTANCE` no .env),
 * se ainda não pertencer a nenhuma conta.
 */
async function legacyInstance() {
  const name = String(process.env.EVOLUTION_INSTANCE || '').trim();
  if (!name) return null;
  return (await redis.hexists(BY_INSTANCE_KEY, name)) ? null : name;
}

async function save(account) {
  await redis.set(ACCOUNT_KEY(account.id), JSON.stringify(account));
  return account;
}

/**
 * Cria a conta. A instância da Evolution recebe um nome derivado do id, então
 * cada conta pareia o próprio número sem escolher nome nem colidir com outra.
 *
 * A primeira conta do sistema adota as conversas da versão single-tenant, se
 * houver — ver adoptLegacyData() em redis.js.
 */
export async function createAccount({ name, email, password, company = '' }) {
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(name || '').trim();

  if (!cleanName) throw new AccountError('Informe seu nome');
  if (!EMAIL_RE.test(cleanEmail)) throw new AccountError('E-mail inválido');
  if (String(password || '').length < MIN_PASSWORD) {
    throw new AccountError(`A senha precisa de pelo menos ${MIN_PASSWORD} caracteres`);
  }

  const id = randomBytes(6).toString('hex');

  // HSETNX é o que impede duas contas com o mesmo e-mail em requisições
  // simultâneas — checar antes com HGET deixaria uma janela de corrida.
  const claimed = await redis.hsetnx(BY_EMAIL_KEY, cleanEmail, id);
  if (!claimed) throw new AccountError('Este e-mail já tem conta', 409);

  const isFirst = (await redis.scard(IDS_KEY)) === 0;
  const adopting = isFirst && await hasLegacyData();

  // Só a conta que ADOTA os dados da versão single-tenant herda o nome de
  // instância do .env: o número daquela instalação já está pareado nele, e
  // trocar obrigaria a ler o QR de novo sem motivo. Instalação nova não
  // sequestra `EVOLUTION_INSTANCE` — cada conta pareia a sua.
  const instanceName = (adopting && await legacyInstance()) || `hub-${id}`;

  const account = {
    id,
    name: cleanName,
    email: cleanEmail,
    company: String(company || '').trim(),
    passwordHash: await hashPassword(password),
    instanceName,
    onboardedAt: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  await save(account);
  await redis.hset(BY_INSTANCE_KEY, instanceName, id);
  await redis.sadd(IDS_KEY, id);

  if (adopting) await adoptLegacyData(id);

  return account;
}

/** Login: devolve a conta ou null. Mesma resposta para e-mail e senha errados. */
export async function authenticate(email, password) {
  const account = await findByEmail(email);
  if (!account) return null;
  if (!await verifyPassword(String(password || ''), account.passwordHash)) return null;

  account.lastLoginAt = new Date().toISOString();
  await save(account);

  return account;
}

/** Marca o onboarding como concluído (número pareado). Uma vez só. */
export async function markOnboarded(id) {
  const account = await getAccount(id);
  if (!account || account.onboardedAt) return account;

  account.onboardedAt = new Date().toISOString();
  return save(account);
}

export async function updateAccount(id, patch) {
  const account = await getAccount(id);
  if (!account) return null;

  // e-mail, id e instância não mudam por patch: os índices apontariam para o
  // lugar errado e o webhook perderia a conta.
  const { id: _id, email, instanceName, passwordHash, ...safe } = patch || {};

  return save({ ...account, ...safe });
}
