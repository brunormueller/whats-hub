import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('connect', () => console.log('🔴 Redis conectado'));
redis.on('error', (err) => console.error('Redis erro:', err));

/* ------------------------------------------------------------------ *
 * Namespace por conta
 *
 * Cada conta é um tenant isolado: conversas, leads e configuração da IA
 * vivem sob `t:<contaId>:`. Nenhuma função de dados aceita ser chamada sem
 * conta — passar undefined aqui vazaria dados entre clientes, então é erro
 * na hora em vez de leitura silenciosa da chave errada.
 * ------------------------------------------------------------------ */

const MAX_MESSAGES_PER_CONVERSATION = 200;

function ns(accountId) {
  if (!accountId) throw new Error('accountId é obrigatório para acessar dados da conta');
  return `t:${accountId}`;
}

const conversationKey = (accountId, phoneNumber) => `${ns(accountId)}:conv:${phoneNumber}`;
const conversationListKey = (accountId) => `${ns(accountId)}:conversations`;
const leadListKey = (accountId) => `${ns(accountId)}:leads`;
export const aiConfigKey = (accountId) => `${ns(accountId)}:ai:config`;

function parse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Formata uma mensagem no padrão "Usuário: mensagem"
 *
 * `options.label`       sobrescreve o autor exibido (a IA assina com o nome do agente)
 * `options.author`      marca a origem: 'human' (padrão) | 'ai'
 * `options.waMessageId` id da mensagem no WhatsApp — a Cloud API exige ele para
 *                       mostrar o indicador de "digitando…"
 */
export function formatMessage(from, text, direction = 'inbound', options = {}) {
  const label = options.label || (direction === 'inbound' ? from : 'Operador');
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from,
    label,
    text,
    direction,   // 'inbound' | 'outbound'
    author: options.author || (direction === 'inbound' ? 'contact' : 'human'),
    ...(options.waMessageId ? { waMessageId: options.waMessageId } : {}),
    timestamp: new Date().toISOString(),
    formatted: `${label}: ${text}`,
  };
}

/**
 * Salva mensagem e atualiza metadados da conversa
 */
export async function saveMessage(accountId, phoneNumber, message) {
  const key = conversationKey(accountId, phoneNumber);

  // Salva a mensagem no histórico da conversa (lista Redis)
  await redis.rpush(key, JSON.stringify(message));
  await redis.ltrim(key, -MAX_MESSAGES_PER_CONVERSATION, -1);

  // Atualiza ou cria metadados da conversa na lista global.
  // O spread preserva flags gravadas por outros fluxos (ex.: aiPaused).
  const existing = await getConversationMeta(accountId, phoneNumber);

  const meta = {
    ...existing,
    phoneNumber,
    lastMessage: message.formatted,
    lastTimestamp: message.timestamp,
    unread: message.direction === 'inbound'
      ? (existing?.unread || 0) + 1
      : 0,
    ...(existing?.firstTimestamp ? {} : { firstTimestamp: message.timestamp }),
  };

  await redis.hset(conversationListKey(accountId), phoneNumber, JSON.stringify(meta));
}

/**
 * Metadados de uma conversa (última mensagem, unread, flags da IA)
 */
export async function getConversationMeta(accountId, phoneNumber) {
  return parse(await redis.hget(conversationListKey(accountId), phoneNumber));
}

/**
 * Grava flags na conversa (ex.: { aiPaused: true } após um handoff)
 * e devolve os metadados atualizados.
 */
export async function setConversationFlags(accountId, phoneNumber, patch) {
  const existing = await getConversationMeta(accountId, phoneNumber);
  const meta = { ...existing, phoneNumber, ...patch };
  await redis.hset(conversationListKey(accountId), phoneNumber, JSON.stringify(meta));
  return meta;
}

/**
 * Busca o histórico de mensagens de um número
 */
export async function getConversation(accountId, phoneNumber) {
  const raw = await redis.lrange(conversationKey(accountId, phoneNumber), 0, -1);
  return raw.map(parse).filter(Boolean);
}

/**
 * Lista todas as conversas da conta (para a sidebar do dashboard)
 */
export async function listConversations(accountId) {
  const all = await redis.hgetall(conversationListKey(accountId));
  if (!all) return [];

  return Object.values(all)
    .map(parse)
    .filter(Boolean)
    .sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
}

/* ------------------------------------------------------------------ *
 * Leads (campos que a IA coletou na conversa)
 * ------------------------------------------------------------------ */

/**
 * Grava/atualiza o lead de um número. Um lead por conversa: quando a IA
 * completa a coleta de novo (cliente reagenda, corrige um dado), o registro é
 * sobrescrito e `capturedAt` mantém a primeira captura.
 */
export async function saveLead(accountId, phoneNumber, fields, extra = {}) {
  const existing = await getLead(accountId, phoneNumber);
  const now = new Date().toISOString();

  const lead = {
    phoneNumber,
    fields,
    capturedAt: existing?.capturedAt || now,
    updatedAt: now,
    ...extra,
  };

  await redis.hset(leadListKey(accountId), phoneNumber, JSON.stringify(lead));
  return lead;
}

export async function getLead(accountId, phoneNumber) {
  return parse(await redis.hget(leadListKey(accountId), phoneNumber));
}

/** Todos os leads da conta, mais recentes primeiro. */
export async function listLeads(accountId) {
  const all = await redis.hgetall(leadListKey(accountId));
  if (!all) return [];

  return Object.values(all)
    .map(parse)
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Marca conversa como lida (zera unread)
 */
export async function markAsRead(accountId, phoneNumber) {
  const meta = await getConversationMeta(accountId, phoneNumber);
  if (!meta) return;
  meta.unread = 0;
  await redis.hset(conversationListKey(accountId), phoneNumber, JSON.stringify(meta));
}

/* ------------------------------------------------------------------ *
 * Migração das chaves sem conta
 *
 * A versão anterior era single-tenant: `conversations`, `leads`, `ai:config` e
 * `conv:<telefone>` na raiz. Em vez de descartar esse histórico, a primeira
 * conta criada o adota.
 * ------------------------------------------------------------------ */

const LEGACY_KEYS = ['conversations', 'leads', 'ai:config'];

/** Existe dado da versão single-tenant esperando por um dono? */
export async function hasLegacyData() {
  for (const key of LEGACY_KEYS) {
    if (await redis.exists(key)) return true;
  }
  const [, found] = await redis.scan(0, 'MATCH', 'conv:*', 'COUNT', 100);
  return found.length > 0;
}

/**
 * Move as chaves sem namespace para dentro de uma conta.
 * Idempotente: chave que já não existe é ignorada, e RENAME não sobrescreve
 * destino já preenchido (checa antes).
 */
export async function adoptLegacyData(accountId) {
  const moved = [];

  const rename = async (from, to) => {
    if (!(await redis.exists(from))) return;
    if (await redis.exists(to)) return;   // conta já tem o próprio dado
    await redis.rename(from, to);
    moved.push(from);
  };

  await rename('conversations', conversationListKey(accountId));
  await rename('leads', leadListKey(accountId));
  await rename('ai:config', aiConfigKey(accountId));

  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'conv:*', 'COUNT', 200);
    cursor = next;
    for (const key of keys) {
      const phoneNumber = key.slice('conv:'.length);
      await rename(key, conversationKey(accountId, phoneNumber));
    }
  } while (cursor !== '0');

  if (moved.length) {
    console.log(`📦 ${moved.length} chave(s) da versão sem contas adotadas por ${accountId}`);
  }

  return moved.length;
}

export default redis;
