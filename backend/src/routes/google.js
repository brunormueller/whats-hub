/**
 * Conexão da conta com o Google Calendar.
 *
 * GET    /api/google/status    → { configured, connected, email, settings }
 * PUT    /api/google/settings  → ajustes de agenda (liga/desliga, duração, expediente)
 * POST   /api/google/connect   → { url } para onde mandar o navegador
 * GET    /api/google/callback  → volta do Google (pública; o `state` assinado identifica a conta)
 * DELETE /api/google           → desconecta e revoga o acesso
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getAiConfig, saveAiConfig } from '../services/aiConfig.js';
import {
  CalendarError,
  calendarSettings,
  authUrl,
  completeAuth,
  disconnect,
  getConnection,
  googleConfigured,
} from '../services/googleCalendar.js';

const router = Router();

const frontend = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

router.get('/status', authMiddleware, async (req, res) => {
  const [connection, config] = await Promise.all([
    getConnection(req.account.id),
    getAiConfig(req.account.id),
  ]);
  res.json({
    configured: googleConfigured(),
    connected: Boolean(connection),
    email: connection?.email || '',
    settings: calendarSettings(config),
  });
});

// Rota própria (e não PUT /api/ai/config): a tela de comportamento publica o
// objeto inteiro, e uma cópia velha dele reverteria o que foi mudado aqui.
router.put('/settings', authMiddleware, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Corpo deve ser o objeto de ajustes' });
  }

  const current = await getAiConfig(req.account.id);
  const settings = calendarSettings({ calendar: { ...current.calendar, ...body } });

  if (settings.enabled && !(await getConnection(req.account.id))) {
    return res.status(409).json({ error: 'Conecte o Google antes de ligar o agendamento' });
  }
  if (settings.start >= settings.end) {
    return res.status(400).json({ error: 'O início do expediente precisa ser antes do fim' });
  }

  await saveAiConfig(req.account.id, { calendar: settings });
  res.json({ settings });
});

router.post('/connect', authMiddleware, (req, res) => {
  try {
    res.json({ url: authUrl(req.account.id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const back = (params) => res.redirect(`${frontend()}/?${new URLSearchParams(params)}`);

  if (error || !code || !state) {
    return back({ google: 'error', reason: error === 'access_denied' ? 'Acesso negado no Google' : 'Autorização incompleta' });
  }

  try {
    await completeAuth(String(code), String(state));
    back({ google: 'connected' });
  } catch (err) {
    if (!(err instanceof CalendarError)) console.error('Google OAuth falhou:', err.message);
    back({ google: 'error', reason: err instanceof CalendarError ? err.message : 'Não foi possível conectar o Google' });
  }
});

router.delete('/', authMiddleware, async (req, res) => {
  await disconnect(req.account.id);
  const current = await getAiConfig(req.account.id);
  if (current.calendar?.enabled) {
    await saveAiConfig(req.account.id, { calendar: { ...current.calendar, enabled: false } });
  }
  res.json({ connected: false });
});

export default router;
