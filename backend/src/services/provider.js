/**
 * Seleciona o provider de WhatsApp em uso.
 *
 * WHATSAPP_PROVIDER=evolution  → Evolution API (número próprio, QR code)
 * WHATSAPP_PROVIDER=meta       → WhatsApp Cloud API (número oficial da Meta)
 */
import * as meta from './whatsapp.js';
import * as evolution from './evolution.js';

const PROVIDERS = { meta, evolution };

export const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'evolution').toLowerCase();

const impl = PROVIDERS[PROVIDER];

if (!impl) {
  throw new Error(
    `WHATSAPP_PROVIDER inválido: "${PROVIDER}". Use "evolution" ou "meta".`
  );
}

export const isEvolution = PROVIDER === 'evolution';

export const sendWhatsAppMessage = impl.sendWhatsAppMessage;
export const extractInboundMessage = impl.extractInboundMessage;
export const instanceFromWebhook = impl.instanceFromWebhook;

// Presença ("digitando…") é opcional: provider sem suporte não pode derrubar o
// envio da resposta, só não mostra o indicador.
export const sendPresence = impl.sendPresence
  || (async () => ({ skipped: true, reason: `provider ${PROVIDER} não envia presença` }));

export default impl;
