import { Router } from 'express';
import {
  createInstance,
  connectInstance,
  connectionState,
  logoutInstance,
  setWebhook,
} from '../services/evolution.js';
import { markOnboarded } from '../services/accounts.js';

const router = Router();

/**
 * A instância é a da conta logada — não vem do .env. Isso é o que mantém o
 * número de cada cliente separado na mesma Evolution API.
 */
function instanceOf(req) {
  return req.account.instanceName;
}

/** Encapsula o erro do provider em uma resposta HTTP */
function wrap(handler) {
  return async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (err) {
      console.error('Evolution:', err.message);
      res.status(502).json({ error: err.message });
    }
  };
}

/**
 * GET /api/instance
 * Estado da conexão: 'open' | 'connecting' | 'close' | 'not_found'
 *
 * É aqui que o onboarding se conclui: número pareado ('open') marca
 * `onboardedAt` na conta e libera o resto do produto.
 */
router.get('/', wrap(async (req) => {
  const result = await connectionState(instanceOf(req));

  if (result.state === 'open' && !req.account.onboardedAt) {
    const account = await markOnboarded(req.account.id);
    req.account = account || req.account;
    console.log(`✅ Onboarding concluído: ${req.account.email}`);
  }

  return { ...result, onboarded: Boolean(req.account.onboardedAt) };
}));

/**
 * POST /api/instance
 * Cria a instância na Evolution API (idempotente)
 */
router.post('/', wrap((req) => createInstance(instanceOf(req))));

/**
 * GET /api/instance/qr[?number=5511999990000]
 * QR code (data URI base64) para pareamento. Com `number`, retorna
 * pairing code de 8 dígitos em vez de QR.
 * Cria a instância automaticamente se ela ainda não existir.
 */
router.get('/qr', wrap(async (req) => {
  const instance = instanceOf(req);
  const { state } = await connectionState(instance);
  if (state === 'not_found') await createInstance(instance);
  return connectInstance(instance, req.query.number);
}));

/**
 * POST /api/instance/webhook
 * Registra EVOLUTION_WEBHOOK_URL na instância
 */
router.post('/webhook', wrap((req) => setWebhook(instanceOf(req))));

/**
 * DELETE /api/instance
 * Desconecta o número (logout do WhatsApp)
 */
router.delete('/', wrap((req) => logoutInstance(instanceOf(req))));

export default router;
