import { Router } from 'express';
import { io } from '../index.js';
import { sendWhatsAppMessage } from '../services/provider.js';
import {
  formatMessage,
  saveMessage,
  getConversation,
  listConversations,
} from '../services/redis.js';
import { broadcastMessage } from '../services/socket.js';
import { getAiConfig } from '../services/aiConfig.js';
import { pauseAi } from '../services/autoReply.js';

const router = Router();

/**
 * GET /api/messages
 * Lista as conversas da conta logada (sidebar do dashboard)
 */
router.get('/', async (req, res) => {
  res.json(await listConversations(req.account.id));
});

/**
 * GET /api/messages/:phoneNumber
 * Histórico completo de uma conversa
 */
router.get('/:phoneNumber', async (req, res) => {
  res.json(await getConversation(req.account.id, req.params.phoneNumber));
});

/**
 * POST /api/messages/:phoneNumber
 * Operador envia mensagem para um número
 * Body: { text: "Olá, como posso ajudar?" }
 */
router.post('/:phoneNumber', async (req, res) => {
  const { phoneNumber } = req.params;
  const { text } = req.body;
  const { account } = req;

  if (!text?.trim()) {
    return res.status(400).json({ error: 'Campo "text" é obrigatório' });
  }

  // Sai pelo número da própria conta (instância da Evolution dela)
  try {
    await sendWhatsAppMessage(account.instanceName, phoneNumber, text);
  } catch (err) {
    console.error('Falha ao enviar:', err.message);
    return res.status(502).json({ error: err.message });
  }

  const message = formatMessage(phoneNumber, text, 'outbound');

  // Persiste e transmite
  await saveMessage(account.id, phoneNumber, message);
  broadcastMessage(io, account.id, phoneNumber, message);

  // O operador digitando É a interrupção: a IA sai desta conversa para não
  // falar por cima. Volta pelo botão "Reativar IA".
  const config = await getAiConfig(account.id);
  if (config.pauseOnOperatorReply !== false) {
    await pauseAi(io, account.id, phoneNumber, 'Operador respondeu na conversa');
  }

  console.log(`📤 [${account.name}] ${message.formatted}`);
  res.json(message);
});

export default router;
