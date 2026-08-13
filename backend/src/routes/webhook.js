import { Router } from 'express';
import { io } from '../index.js';
import {
  extractInboundMessage,
  instanceFromWebhook,
  isEvolution,
} from '../services/provider.js';
import { formatMessage, saveMessage } from '../services/store.js';
import { broadcastMessage } from '../services/socket.js';
import { maybeAutoReply } from '../services/autoReply.js';
import { countAccounts, findByInstance, listAccountIds, getAccount } from '../services/accounts.js';

const router = Router();

/**
 * GET /webhook
 * Verificação inicial exigida pela Meta ao registrar o webhook.
 * A Evolution API não faz challenge — responde apenas um health check.
 */
router.get('/', (req, res) => {
  if (isEvolution) {
    return res.status(200).json({ ok: true, provider: 'evolution' });
  }

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado pela Meta');
    return res.status(200).send(challenge);
  }

  res.status(403).json({ error: 'Verificação falhou' });
});

/**
 * De qual conta é esta mensagem?
 *
 * Evolution: o payload traz o nome da instância, e cada conta tem a sua
 * (`accounts:byInstance`). Uma única URL de webhook serve todos os clientes.
 *
 * Meta: a Cloud API tem um `WHATSAPP_PHONE_NUMBER_ID` só no .env, então não há
 * o que resolver — cai na única conta existente. Com mais de uma conta a
 * mensagem é recusada em vez de ir para a conta errada.
 */
async function resolveAccount(body) {
  const instanceName = instanceFromWebhook(body);

  if (instanceName) {
    const account = await findByInstance(instanceName);
    if (!account) {
      console.warn(`⚠️  Webhook da instância "${instanceName}" sem conta correspondente — ignorado`);
    }
    return account;
  }

  if (await countAccounts() > 1) {
    console.warn('⚠️  Webhook sem instância no payload e mais de uma conta cadastrada — ignorado');
    return null;
  }

  const [onlyId] = await listAccountIds();
  return onlyId ? getAccount(onlyId) : null;
}

/**
 * Recebe mensagens enviadas pelos usuários do WhatsApp.
 */
async function handleInbound(req, res) {
  // Responde imediatamente ao provider (Meta exige < 20s)
  res.sendStatus(200);

  const inbound = extractInboundMessage(req.body);
  if (!inbound) return; // ignora eventos que não são mensagens de texto

  const account = await resolveAccount(req.body);
  if (!account) return;

  // `waMessageId` fica guardado na mensagem porque a Cloud API só mostra o
  // indicador de "digitando…" citando o id do inbound.
  const message = formatMessage(inbound.from, inbound.text, 'inbound', {
    waMessageId: inbound.waMessageId,
  });

  // Persiste no Redis, sob a conta dona do número
  await saveMessage(account.id, inbound.from, message);

  // Transmite ao dashboard daquela conta em tempo real
  broadcastMessage(io, account.id, inbound.from, message);

  console.log(`📩 [${account.name}] ${message.formatted}`);

  // Resposta automática pela IA (respeita o comportamento configurado).
  // Roda depois do broadcast: o operador vê a mensagem do cliente na hora,
  // a resposta chega quando o modelo terminar.
  await maybeAutoReply(io, account, inbound.from);
}

// POST /webhook
router.post('/', handleInbound);

// POST /webhook/:event — a Evolution API com webhook_by_events ativado
// envia para URLs por evento (ex.: /webhook/messages-upsert)
router.post('/:event', handleInbound);

export default router;
