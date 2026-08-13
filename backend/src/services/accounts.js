/**
 * Contas do produto: cadastro, login e o vínculo entre a conta e a instância
 * de WhatsApp dela.
 *
 * Uma conta = um cliente do SaaS. Base única: os dados de atendimento ficam
 * marcados com `accountId` nas coleções de `store.js`; aqui vive só o cadastro,
 * na coleção `accounts` (`_id` = id da conta).
 *
 * Senha: scrypt com salt aleatório por conta. Sem dependência externa — o
 * `crypto` do Node já traz a KDF, e o formato guardado carrega os parâmetros,
 * então dá para endurecer o custo depois sem invalidar as senhas antigas.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { accounts } from './mongo.js';

const scrypt = promisify(scryptCb);

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

/**
 * O resto do código usa `account.id`; no Mongo o campo é `_id`. A tradução
 * fica nesta função só, então nenhum consumidor precisa saber do `_id`.
 */
function toAccount(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function getAccount(id) {
  if (!id) return null;
  return toAccount(await accounts().findOne({ _id: id }));
}

export async function findByEmail(email) {
  return toAccount(await accounts().findOne({ email: normalizeEmail(email) }));
}

/** Qual conta é dona de uma instância da Evolution (usado pelo webhook). */
export async function findByInstance(instanceName) {
  if (!instanceName) return null;
  return toAccount(await accounts().findOne({ instanceName }));
}

export async function countAccounts() {
  return accounts().countDocuments();
}

/** Ids de todas as contas. */
export async function listAccountIds() {
  return accounts().distinct('_id');
}

/** Sem dados sensíveis: é isso que vai para o front. */
export function publicAccount(account) {
  if (!account) return null;
  const { passwordHash, ...rest } = account;
  return rest;
}

/**
 * Endereço da instância desta conta, no formato que as funções do provider
 * esperam: qual sessão do WhatsApp, em qual container Evolution.
 */
export function instanceTarget(account) {
  return {
    instanceName: account?.instanceName,
    evolutionUrl: account?.evolutionUrl,
  };
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

/**
 * Cria a conta. A instância da Evolution recebe um nome derivado do id, então
 * cada cliente pareia o próprio número sem escolher nome nem colidir com outro.
 *
 * `evolutionUrl` é congelada no cadastro: um container Evolution aguenta umas
 * dezenas de sessões do Baileys, e quando entrar um segundo container as contas
 * novas apontam para ele sem mexer nas antigas — a sessão de um cliente vive no
 * volume de um container só.
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

  const account = {
    _id: id,
    name: cleanName,
    email: cleanEmail,
    company: String(company || '').trim(),
    passwordHash: await hashPassword(password),
    instanceName: `hub-${id}`,
    evolutionUrl: String(process.env.EVOLUTION_API_URL || '').replace(/\/+$/, ''),
    onboardedAt: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  // O índice único em `email` é o que impede duas contas com o mesmo e-mail em
  // cadastros simultâneos — checar antes com findOne deixaria uma janela de
  // corrida entre a leitura e a escrita.
  try {
    await accounts().insertOne(account);
  } catch (err) {
    if (err?.code === 11000) throw new AccountError('Este e-mail já tem conta', 409);
    throw err;
  }

  return toAccount(account);
}

/** Login: devolve a conta ou null. Mesma resposta para e-mail e senha errados. */
export async function authenticate(email, password) {
  const account = await findByEmail(email);
  if (!account) return null;
  if (!await verifyPassword(String(password || ''), account.passwordHash)) return null;

  const lastLoginAt = new Date().toISOString();
  await accounts().updateOne({ _id: account.id }, { $set: { lastLoginAt } });

  return { ...account, lastLoginAt };
}

/** Marca o onboarding como concluído (número pareado). Uma vez só. */
export async function markOnboarded(id) {
  const doc = await accounts().findOneAndUpdate(
    // O filtro por `onboardedAt: null` é o "uma vez só": a segunda chamada não
    // encontra documento e não reescreve a data.
    { _id: id, onboardedAt: null },
    { $set: { onboardedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );

  return doc ? toAccount(doc) : getAccount(id);
}

export async function updateAccount(id, patch) {
  // e-mail, id, instância e senha não mudam por patch: os índices apontariam
  // para o lugar errado e o webhook perderia a conta.
  const { id: _id, email, instanceName, passwordHash, evolutionUrl, ...safe } = patch || {};

  if (Object.keys(safe).length === 0) return getAccount(id);

  const doc = await accounts().findOneAndUpdate(
    { _id: id },
    { $set: safe },
    { returnDocument: 'after' },
  );

  return toAccount(doc);
}
