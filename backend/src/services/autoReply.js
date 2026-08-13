/**
 * Resposta automática: liga o webhook (mensagem recebida) à API do Claude
 * e devolve o texto pelo provider de WhatsApp configurado.
 *
 * Regras de parada, em ordem:
 *   1. ANTHROPIC_API_KEY ausente          → não responde
 *   2. config.autoReply desligado          → não responde (switch "IA ativa")
 *   3. conversa pausada pelo operador      → não responde, humano assumiu
 *
 * Handoff NÃO para a IA. O modelo marcando handoff só levanta `needsHuman` na
 * conversa (chip "Escalada" no inbox): o time é avisado e a IA continua
 * conduzindo o atendimento até alguém pausar de fato. Quem quiser o
 * comportamento antigo — escalar e calar — liga `handoffPauses` na config.
 */
import { sendWhatsAppMessage, sendPresence } from './provider.js';
import { aiConfigured, generateReply } from './ai.js';
import { getAiConfig } from './aiConfig.js';
import { handleLead } from './leads.js';
import { instanceTarget } from './accounts.js';
import {
  formatMessage,
  saveMessage,
  getConversation,
  getConversationMeta,
  setConversationFlags,
} from './store.js';
import { broadcastMessage, broadcastConversationUpdate } from './socket.js';

// Duas mensagens em sequência do mesmo número não podem virar duas chamadas
// concorrentes ao modelo — a segunda esperaria o mesmo histórico e responderia
// duas vezes. O lock é por número e vive só neste processo.
//
// Mas descartar a segunda mensagem também não serve: com a espera de digitação
// a janela do lock passa de segundos, e o cliente que emenda duas frases
// ficaria sem resposta para a segunda. Então quem chega durante a execução
// marca `pending` e o dono do lock roda outra volta — aí o histórico já tem as
// duas mensagens e a IA responde as duas de uma vez.
const running = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Quanto tempo "digitando…" antes de enviar: proporcional ao tamanho da
 * resposta, preso entre o mínimo e o máximo da configuração.
 */
export function typingDelay(text, config = {}) {
  if (!config.typing) return 0;

  const perChar = Number(config.typingMsPerChar);
  if (!Number.isFinite(perChar) || perChar <= 0) return 0;

  const min = Math.max(0, Number(config.typingMinMs) || 0);
  const max = Math.max(min, Number(config.typingMaxMs) || min);

  return Math.round(Math.min(Math.max(text.length * perChar, min), max));
}

/** Id da última mensagem do cliente — a Cloud API exige ele para a presença. */
function lastInboundId(history = []) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.direction === 'inbound') return history[i].waMessageId || null;
  }
  return null;
}

/**
 * Mostra "digitando…" e espera o tempo calculado.
 *
 * A Evolution segura a presença por `delay` ms do lado dela, então a espera
 * local roda EM PARALELO com a requisição — em série o cliente esperaria o
 * dobro. Presença é cosmética: se falhar, a resposta sai igual.
 */
async function typeBeforeSend({ account, phoneNumber, text, config, history }) {
  const delayMs = typingDelay(text, config);
  if (delayMs <= 0) return;

  await Promise.all([
    sendPresence(instanceTarget(account), phoneNumber, {
      presence: 'composing',
      delayMs,
      messageId: lastInboundId(history),
    }).catch((err) => {
      console.warn(`⚠️  Presença "digitando" falhou para ${phoneNumber}: ${err.message}`);
    }),
    sleep(delayMs),
  ]);
}

export async function maybeAutoReply(io, account, phoneNumber) {
  if (!aiConfigured()) return;

  // O lock é por conta + número: duas contas com o mesmo cliente não se
  // atropelam.
  const lockKey = `${account.id}:${phoneNumber}`;

  const active = running.get(lockKey);
  if (active) {
    // Já tem uma resposta em andamento para este número: só sinaliza que
    // chegou mensagem nova e deixa o dono do lock dar outra volta.
    active.pending = true;
    return;
  }

  const state = { pending: false };
  running.set(lockKey, state);

  try {
    do {
      state.pending = false;
      await replyOnce(io, account, phoneNumber);
    } while (state.pending);
  } finally {
    running.delete(lockKey);
  }
}

/**
 * Uma passada: lê a configuração e o histórico agora, gera e envia a resposta.
 * As guardas ficam aqui de propósito — se o operador assumir a conversa
 * durante a espera de digitação, a volta seguinte já não responde.
 */
async function replyOnce(io, account, phoneNumber) {
  const config = await getAiConfig(account.id);
  if (!config.autoReply) return;

  const meta = await getConversationMeta(account.id, phoneNumber);
  if (meta?.aiPaused) return;

  try {
    const history = await getConversation(account.id, phoneNumber);
    const result = await generateReply({ config, history });

    const text = result.reply?.trim();

    if (text) {
      // Ritmo humano: o indicador aparece e a mensagem só sai depois da pausa.
      await typeBeforeSend({ account, phoneNumber, text, config, history });

      await sendWhatsAppMessage(instanceTarget(account), phoneNumber, text);

      const message = formatMessage(phoneNumber, text, 'outbound', {
        label: config.agentName,
        author: 'ai',
      });

      await saveMessage(account.id, phoneNumber, message);
      broadcastMessage(io, account.id, phoneNumber, message);

      console.log(`🤖 [${account.name}] ${message.formatted}`);
    }

    if (result.handoff) {
      // Escalar é avisar, não desligar: `needsHuman` acende o chip no inbox e a
      // IA segue respondendo. Só `handoffPauses` (opt-in) volta a calar a IA.
      const pause = Boolean(config.handoffPauses);

      const flags = {
        needsHuman: true,
        handoffReason: result.handoffReason,
        handoffAt: new Date().toISOString(),
        ...(pause ? { aiPaused: true } : {}),
      };

      await setConversationFlags(account.id, phoneNumber, flags);
      broadcastConversationUpdate(io, account.id, phoneNumber, flags);

      console.log(
        `🙋 Escalada em ${phoneNumber}: ${result.handoffReason || 'sem motivo'}`
        + `${pause ? ' (IA pausada)' : ' (IA continua)'}`,
      );
    }

    // Grava o progresso da coleta e, quando o lead fecha, avisa quem cuida
    // dele. Roda depois do envio: o cliente não espera o aviso interno para
    // receber a resposta.
    await handleLead({ io, account, phoneNumber, lead: result.lead, config, meta });
  } catch (err) {
    // Falha da IA não pode derrubar o webhook: a mensagem do cliente já foi
    // salva e o operador continua vendo a conversa no dashboard.
    console.error(`⚠️  Resposta automática falhou para ${phoneNumber}:`, err.message);
  }
}

/** Operador assume a conversa: a IA para de responder este número. */
export async function pauseAi(io, accountId, phoneNumber, reason = 'Operador assumiu') {
  const flags = { aiPaused: true, pausedBy: 'human', pauseReason: reason };
  const meta = await setConversationFlags(accountId, phoneNumber, flags);
  broadcastConversationUpdate(io, accountId, phoneNumber, flags);
  return meta;
}

/** Devolve a conversa para a IA e limpa a escalada. */
export async function resumeAi(io, accountId, phoneNumber) {
  const flags = {
    aiPaused: false,
    pausedBy: '',
    pauseReason: '',
    needsHuman: false,
    handoffReason: '',
  };

  const meta = await setConversationFlags(accountId, phoneNumber, flags);
  broadcastConversationUpdate(io, accountId, phoneNumber, flags);
  return meta;
}
