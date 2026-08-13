/**
 * Dados de atendimento: conversas, mensagens e leads.
 *
 * ------------------------------------------------------------------
 * Multi-tenant em base única
 *
 * Uma base para todos os clientes. Cada documento carrega `accountId` e
 * NENHUMA função aqui aceita ser chamada sem conta — passar `undefined`
 * vazaria dados entre clientes, então é erro na hora em vez de query aberta
 * que devolve o mundo. Índices únicos em (accountId, phoneNumber) garantem um
 * documento por conversa/lead por conta.
 * ------------------------------------------------------------------
 */
import { conversations, messages, leads, PUBLIC } from './mongo.js';

// Janela de histórico lida por conversa. O documento antigo não é apagado
// (diferente do trim que o Redis exigia) — só não entra na leitura.
const HISTORY_WINDOW = 200;

function requireAccount(accountId) {
  if (!accountId) throw new Error('accountId é obrigatório para acessar dados da conta');
  return accountId;
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
 * Salva mensagem e atualiza os metadados da conversa.
 *
 * O contador de não lidas usa `$inc` em vez de ler-somar-gravar: duas
 * mensagens do mesmo número chegando juntas somam as duas em vez de uma
 * sobrescrever a outra. `$setOnInsert` guarda a primeira mensagem da conversa
 * (o painel de métricas usa isso como data de abertura).
 */
export async function saveMessage(accountId, phoneNumber, message) {
  requireAccount(accountId);

  await messages().insertOne({ ...message, accountId, phoneNumber });

  const inbound = message.direction === 'inbound';

  await conversations().updateOne(
    { accountId, phoneNumber },
    {
      $set: {
        lastMessage: message.formatted,
        lastTimestamp: message.timestamp,
        // Mensagem enviada zera o contador; recebida soma pelo $inc abaixo.
        ...(inbound ? {} : { unread: 0 }),
      },
      ...(inbound ? { $inc: { unread: 1 } } : {}),
      // `accountId` e `phoneNumber` não entram aqui: o upsert já grava os
      // campos de igualdade do filtro no documento novo.
      $setOnInsert: { firstTimestamp: message.timestamp },
    },
    { upsert: true },
  );
}

/**
 * Metadados de uma conversa (última mensagem, unread, flags da IA)
 */
export async function getConversationMeta(accountId, phoneNumber) {
  requireAccount(accountId);
  return conversations().findOne({ accountId, phoneNumber }, { projection: PUBLIC });
}

/**
 * Grava flags na conversa (ex.: { aiPaused: true } após um handoff)
 * e devolve os metadados atualizados.
 */
export async function setConversationFlags(accountId, phoneNumber, patch) {
  requireAccount(accountId);

  return conversations().findOneAndUpdate(
    { accountId, phoneNumber },
    { $set: { ...patch } },
    { upsert: true, returnDocument: 'after', projection: PUBLIC },
  );
}

/**
 * Histórico de mensagens de um número — as HISTORY_WINDOW mais recentes, em
 * ordem cronológica. Busca do fim para o começo (é o que o índice serve) e
 * inverte no final.
 */
export async function getConversation(accountId, phoneNumber) {
  requireAccount(accountId);

  const recent = await messages()
    .find({ accountId, phoneNumber }, { projection: PUBLIC })
    .sort({ timestamp: -1, _id: -1 })
    .limit(HISTORY_WINDOW)
    .toArray();

  return recent.reverse();
}

/**
 * Lista todas as conversas da conta (para a sidebar do dashboard)
 */
export async function listConversations(accountId) {
  requireAccount(accountId);

  return conversations()
    .find({ accountId }, { projection: PUBLIC })
    .sort({ lastTimestamp: -1 })
    .toArray();
}

/* ------------------------------------------------------------------ *
 * Leads (campos que a IA coletou na conversa)
 * ------------------------------------------------------------------ */

/**
 * Grava/atualiza o lead de um número. Um lead por conversa: quando a IA
 * completa a coleta de novo (cliente reagenda, corrige um dado), o registro é
 * sobrescrito e `capturedAt` mantém a primeira captura — daí o $setOnInsert.
 */
export async function saveLead(accountId, phoneNumber, fields, extra = {}) {
  requireAccount(accountId);

  const now = new Date().toISOString();

  return leads().findOneAndUpdate(
    { accountId, phoneNumber },
    {
      $set: { fields, updatedAt: now, ...extra },
      $setOnInsert: { capturedAt: now },
    },
    { upsert: true, returnDocument: 'after', projection: PUBLIC },
  );
}

export async function getLead(accountId, phoneNumber) {
  requireAccount(accountId);
  return leads().findOne({ accountId, phoneNumber }, { projection: PUBLIC });
}

/** Todos os leads da conta, mais recentes primeiro. */
export async function listLeads(accountId) {
  requireAccount(accountId);

  return leads()
    .find({ accountId }, { projection: PUBLIC })
    .sort({ updatedAt: -1 })
    .toArray();
}

/**
 * Marca conversa como lida (zera unread)
 */
export async function markAsRead(accountId, phoneNumber) {
  requireAccount(accountId);
  await conversations().updateOne({ accountId, phoneNumber }, { $set: { unread: 0 } });
}
