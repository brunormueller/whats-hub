const BASE_URL = 'https://graph.facebook.com/v19.0';

/**
 * Envia uma mensagem de texto via WhatsApp Cloud API.
 *
 * O primeiro parâmetro existe para a assinatura ser a mesma do provider
 * Evolution (uma instância por conta). Aqui não há instância: a Cloud API tem
 * um único `WHATSAPP_PHONE_NUMBER_ID` no .env, então este provider atende uma
 * conta só — ver a nota sobre multi-tenant no README.
 */
export async function sendWhatsAppMessage(_instance, to, text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`WhatsApp API erro: ${JSON.stringify(err)}`);
  }

  return response.json();
}

/**
 * Marca a conversa como "digitando…".
 *
 * A Cloud API não tem endpoint de presença livre como o Baileys: o indicador
 * é uma resposta à mensagem recebida (e serve de confirmação de leitura), por
 * isso exige o `messageId` do inbound. Sem ele não há o que enviar — devolve
 * `skipped` em vez de estourar, para não travar o envio da resposta.
 *
 * A Meta apaga o indicador sozinha em ~25s ou quando a resposta é enviada, o
 * que torna o `delayMs` do chamador irrelevante aqui.
 */
export async function sendPresence(_instance, to, { messageId } = {}) {
  if (!messageId) return { skipped: true, reason: 'sem messageId do inbound' };

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`WhatsApp API erro (typing_indicator): ${JSON.stringify(err)}`);
  }

  return response.json();
}

/**
 * A Cloud API não tem instância no payload — o webhook cai na única conta
 * conectada por este provider.
 */
export function instanceFromWebhook() {
  return null;
}

/**
 * Extrai os dados relevantes de um payload de webhook da Meta
 * Retorna null se não for uma mensagem de texto
 */
export function extractInboundMessage(body) {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') return null;

    return {
      from: message.from,           // número do remetente (E.164)
      text: message.text.body,
      waMessageId: message.id,
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}
