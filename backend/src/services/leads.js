/**
 * Leads: persistência do que a IA coletou e aviso para quem cuida deles.
 *
 * A coleta vem do bloco `lead` da resposta do modelo (JSON schema montado a
 * partir dos campos ligados na tela) — não existe tag em texto para parsear.
 *
 * Regras:
 *   - progresso parcial é gravado a cada mensagem (o painel mostra 2/3 campos);
 *   - a notificação sai UMA vez por conversa, quando o lead fecha;
 *   - falha no aviso não desfaz o lead nem derruba o atendimento.
 */
import { sendWhatsAppMessage } from './provider.js';
import { instanceTarget } from './accounts.js';
import { saveLead, setConversationFlags } from './store.js';
import { broadcastConversationUpdate, broadcastLead } from './socket.js';

/** Só dígitos: "+55 (11) 99999-0000" → "5511999990000" */
function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function leadSummary(lead) {
  return Object.entries(lead.fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${lead.labels[k] || k}: ${v}`)
    .join('\n');
}

/**
 * Texto do aviso. Sem markdown de negrito com asterisco duplo: no WhatsApp o
 * negrito é *um* asterisco de cada lado.
 */
function notificationText({ lead, phoneNumber, agentName }) {
  return [
    '*Novo lead qualificado*',
    '',
    leadSummary(lead),
    '',
    `Contato: wa.me/${phoneNumber}`,
    `Coletado por: ${agentName || 'IA'}`,
  ].filter(Boolean).join('\n');
}

/**
 * Avisa no WhatsApp de quem cuida dos leads.
 * Retorna o motivo do skip quando não há nada a enviar.
 */
async function notifyOwner({ account, config, lead, phoneNumber }) {
  if (!config.notifyOnLead) return { skipped: 'notifyOnLead desligado' };

  const to = digits(config.notifyPhone);
  if (!to) return { skipped: 'notifyPhone vazio na configuração' };
  if (to === digits(phoneNumber)) return { skipped: 'notifyPhone é o próprio cliente' };

  // Sai pelo número da própria conta — o aviso não vaza para outro tenant.
  await sendWhatsAppMessage(instanceTarget(account), to, notificationText({
    lead,
    phoneNumber: digits(phoneNumber),
    agentName: config.agentName,
  }));

  return { sent: to };
}

/**
 * Processa o bloco `lead` de uma resposta da IA.
 *
 * @param {object} params
 * @param {object} params.io          servidor Socket.IO (broadcast para o painel)
 * @param {object} params.account     conta dona da conversa (id + instanceName)
 * @param {string} params.phoneNumber conversa
 * @param {object} params.lead        bloco normalizado por readLead() em ai.js
 * @param {object} params.config      configuração publicada do agente
 * @param {object} params.meta        metadados atuais da conversa (flags)
 */
export async function handleLead({ io, account, phoneNumber, lead, config, meta }) {
  if (!lead || lead.total === 0) return null;

  // Nada coletado ainda: não polui a conversa com flags vazias.
  if (lead.filled === 0 && !lead.complete) return null;

  const alreadyNotified = Boolean(meta?.leadNotifiedAt);
  const isNew = lead.complete && !alreadyNotified;

  const stored = await saveLead(account.id, phoneNumber, lead.fields, {
    labels: lead.labels,
    complete: lead.complete,
    missing: lead.missing,
    agentName: config.agentName,
    ...(isNew ? { closedAt: new Date().toISOString() } : {}),
  });

  const flags = {
    leadFilled: lead.filled,
    leadTotal: lead.total,
    leadComplete: lead.complete,
  };

  if (isNew) {
    flags.leadNotifiedAt = new Date().toISOString();

    try {
      const result = await notifyOwner({ account, config, lead, phoneNumber });

      flags.leadNotify = result.sent ? `enviado para ${result.sent}` : `sem aviso: ${result.skipped}`;
    } catch (err) {
      // O lead está salvo; o aviso é o que falhou. Guarda o motivo para o
      // painel mostrar em vez de sumir com o erro no log.
      flags.leadNotify = `falhou: ${err.message}`;
      console.error(`⚠️  Aviso de lead falhou para ${phoneNumber}:`, err.message);
    }
  }

  await setConversationFlags(account.id, phoneNumber, flags);
  broadcastConversationUpdate(io, account.id, phoneNumber, flags);

  if (isNew) {
    broadcastLead(io, account.id, stored);
    console.log(`🎯 Lead fechado em ${phoneNumber} (${flags.leadNotify})`);
  }

  return stored;
}
