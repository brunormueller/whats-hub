/**
 * Evolution API v2 — provider alternativo à WhatsApp Cloud API.
 * Permite usar um número pessoal (pareado por QR code) em vez de um
 * número oficial da Meta.
 *
 * Docs: https://doc.evolution-api.com
 */

function config(baseUrlOverride) {
  const baseUrl = (baseUrlOverride || process.env.EVOLUTION_API_URL || 'http://localhost:8080')
    .replace(/\/+$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiKey) {
    throw new Error('EVOLUTION_API_KEY não definida no .env');
  }

  return { baseUrl, apiKey };
}

/**
 * Alvo de uma chamada: qual instância, em qual container.
 *
 * A instância vem da conta (`account.instanceName`), não do .env — cada cliente
 * pareia o próprio número. `evolutionUrl` também vem da conta: um container
 * aguenta umas dezenas de sessões do Baileys, então mais clientes significa
 * mais containers, e a sessão de cada cliente vive no volume de um só. Sem a
 * URL no documento, distribuir exigiria mexer em toda esta camada.
 *
 * Aceita string (resolve pelo .env, usado no provider `meta` e em scripts) ou
 * `{ instanceName, evolutionUrl }`.
 */
function target(instance) {
  const name = typeof instance === 'string' ? instance : instance?.instanceName;
  if (!name) throw new Error('Instância da Evolution não informada');

  return {
    name,
    baseUrl: typeof instance === 'string' ? undefined : instance?.evolutionUrl,
  };
}

async function request(path, { method = 'GET', body, baseUrl: override } = {}) {
  const { baseUrl, apiKey } = config(override);

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new Error(
      `Evolution API inacessível em ${baseUrl} — o container está rodando? (${cause.message})`,
      { cause }
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Evolution API erro (${response.status} ${path}): ${JSON.stringify(payload)}`
    );
  }

  return payload;
}

/**
 * Remove o sufixo de JID do Baileys ("5511999990000@s.whatsapp.net" → "5511999990000")
 */
export function normalizeNumber(value = '') {
  return String(value).split('@')[0].split(':')[0].replace(/\D/g, '');
}

/**
 * Envia uma mensagem de texto pela instância da conta
 */
export async function sendWhatsAppMessage(instance, to, text) {
  const { name, baseUrl } = target(instance);

  return request(`/message/sendText/${name}`, {
    method: 'POST',
    baseUrl,
    body: {
      number: normalizeNumber(to),
      text,
    },
  });
}

/**
 * Baixa a mídia de uma mensagem recebida (fallback quando o webhook não trouxe
 * o base64). Só funciona se a Evolution ainda tiver a mensagem.
 */
export async function fetchMediaBase64(instance, waMessageId) {
  const { name, baseUrl } = target(instance);

  const res = await request(`/chat/getBase64FromMediaMessage/${name}`, {
    method: 'POST',
    baseUrl,
    body: { message: { key: { id: waMessageId } }, convertToMp4: false },
  });

  return res?.base64 || null;
}

/**
 * Envia uma mensagem de voz (nota de voz, com o ícone de microfone). `audio`
 * é um Buffer OGG/Opus.
 */
export async function sendWhatsAppAudio(instance, to, audio) {
  const { name, baseUrl } = target(instance);

  return request(`/message/sendWhatsAppAudio/${name}`, {
    method: 'POST',
    baseUrl,
    body: {
      number: normalizeNumber(to),
      audio: audio.toString('base64'),
      encoding: true,
    },
  });
}

/**
 * Marca a conversa como "digitando…" no WhatsApp do cliente.
 *
 * A Evolution mantém a presença por `delay` ms e depois volta para 'paused',
 * então o valor enviado aqui é o mesmo que o chamador espera antes do envio.
 * `messageId` não é usado neste provider (existe na assinatura só para a
 * WhatsApp Cloud API, que exige o id da mensagem recebida).
 */
export async function sendPresence(instance, to, { presence = 'composing', delayMs = 2000 } = {}) {
  const { name, baseUrl } = target(instance);

  return request(`/chat/sendPresence/${name}`, {
    method: 'POST',
    baseUrl,
    body: {
      number: normalizeNumber(to),
      delay: delayMs,
      presence,
    },
  });
}

/**
 * Extrai o texto de um objeto `message` do Baileys, incluindo os
 * invólucros mais comuns (ephemeral / viewOnce / extendedText).
 */
function extractText(message, depth = 0) {
  if (!message || depth > 3) return null;

  if (typeof message.conversation === 'string') return message.conversation;
  if (typeof message.extendedTextMessage?.text === 'string') {
    return message.extendedTextMessage.text;
  }

  const wrapped =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.documentWithCaptionMessage?.message;

  return extractText(wrapped, depth + 1);
}

/**
 * Nome da instância que recebeu o evento — é por ele que o webhook descobre
 * de qual conta é a mensagem. Uma URL de webhook serve todas as contas.
 */
export function instanceFromWebhook(body) {
  return body?.instance || body?.data?.instance || null;
}

/** Mensagem de áudio (nota de voz ou áudio comum), com os invólucros do Baileys. */
function extractAudio(message, depth = 0) {
  if (!message || depth > 3) return null;
  if (message.audioMessage) return message.audioMessage;

  return extractAudio(
    message.ephemeralMessage?.message
      || message.viewOnceMessage?.message
      || message.viewOnceMessageV2?.message,
    depth + 1,
  );
}

/**
 * Extrai os dados relevantes de um webhook da Evolution API.
 * Retorna null se não for uma mensagem de texto recebida de um contato
 * individual (ignora grupos, status e mensagens enviadas pelo próprio número).
 */
export function extractInboundMessage(body) {
  try {
    const event = String(body?.event || '').toLowerCase().replace(/_/g, '.');
    if (event && event !== 'messages.upsert') return null;

    // `data` pode vir como objeto único ou array (upsert em lote)
    const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
    const key = data?.key;
    if (!key || key.fromMe) return null;

    const remoteJid = key.remoteJid || '';
    // Ignora grupos (@g.us), broadcast/status e newsletters
    if (!remoteJid.endsWith('@s.whatsapp.net')) return null;

    const text = extractText(data.message);
    const audio = text ? null : extractAudio(data.message);
    if (!text && !audio) return null;

    const timestampSeconds = Number(data.messageTimestamp) || Math.floor(Date.now() / 1000);

    return {
      from: normalizeNumber(remoteJid),
      text: text || '',
      // Áudio chega sem texto: o webhook transcreve antes de seguir. O base64
      // vem no payload quando o webhook da instância liga `base64`.
      ...(audio ? {
        audio: {
          base64: data.message?.base64 || data.base64 || null,
          mimetype: audio.mimetype || 'audio/ogg',
          seconds: Number(audio.seconds) || 0,
        },
      } : {}),
      waMessageId: key.id,
      pushName: data.pushName || null,
      timestamp: new Date(timestampSeconds * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Gerenciamento da instância (pareamento do número por QR code)
 * ------------------------------------------------------------------ */

function webhookConfig() {
  const url = process.env.EVOLUTION_WEBHOOK_URL;
  if (!url) return undefined;

  return {
    enabled: true,
    url,
    byEvents: false,
    // Precisa de base64: com DATABASE_SAVE_DATA_NEW_MESSAGE desligado a
    // Evolution não guarda a mensagem, então o áudio só existe neste payload.
    base64: true,
    events: ['MESSAGES_UPSERT'],
  };
}

/**
 * Cria a instância (idempotente: se já existir, a Evolution retorna 403/409
 * e nós tratamos como "já criada")
 */
export async function createInstance(instance) {
  const { name, baseUrl } = target(instance);

  try {
    return await request('/instance/create', {
      method: 'POST',
      baseUrl,
      body: {
        instanceName: name,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: webhookConfig(),
      },
    });
  } catch (err) {
    if (/40[39]|already in use|already exists/i.test(err.message)) {
      return { instance: name, alreadyExists: true };
    }
    throw err;
  }
}

/**
 * Registra/atualiza o webhook da instância existente
 */
export async function setWebhook(instance) {
  const webhook = webhookConfig();
  if (!webhook) throw new Error('EVOLUTION_WEBHOOK_URL não definida no .env');

  const { name, baseUrl } = target(instance);

  return request(`/webhook/set/${name}`, {
    method: 'POST',
    baseUrl,
    body: { webhook },
  });
}

/**
 * Retorna o QR code (data URI base64) para conectar o número.
 * Passando `number` (E.164), a Evolution devolve um pairing code de 8
 * dígitos em vez de exigir a leitura da câmera.
 */
export async function connectInstance(instance, number) {
  const { name, baseUrl } = target(instance);
  const digits = number ? normalizeNumber(number) : '';
  const query = digits ? `?number=${digits}` : '';
  const payload = await request(`/instance/connect/${name}${query}`, { baseUrl });

  return {
    instance: name,
    qrcode: payload?.base64 || null,
    pairingCode: payload?.pairingCode || null,
    code: payload?.code || null,
    // A instância já conectada não devolve nada disso. `code` entra na conta
    // porque a v1 devolve só o texto do QR, sem `base64`: sem ele aqui, uma
    // instância desconectada era reportada como conectada e a tela ficava
    // esperando um QR que nunca vinha.
    connected: !payload?.base64 && !payload?.pairingCode && !payload?.code,
  };
}

/**
 * Estado da conexão: 'open' (conectado), 'connecting', 'close'
 * ou 'not_found' (instância ainda não criada na Evolution).
 */
export async function connectionState(instance) {
  const { name, baseUrl } = target(instance);

  try {
    const payload = await request(`/instance/connectionState/${name}`, { baseUrl });
    return {
      instance: name,
      state: payload?.instance?.state || payload?.state || 'unknown',
    };
  } catch (err) {
    if (/\(404 /.test(err.message)) {
      return { instance: name, state: 'not_found' };
    }
    throw err;
  }
}

/**
 * Desconecta o número da instância (mantém a instância criada)
 */
export async function logoutInstance(instance) {
  const { name, baseUrl } = target(instance);
  return request(`/instance/logout/${name}`, { method: 'DELETE', baseUrl });
}
