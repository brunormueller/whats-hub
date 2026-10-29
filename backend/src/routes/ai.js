/**
 * Configuração e teste do comportamento da IA.
 *
 * GET  /api/ai/config                          → configuração publicada
 * PUT  /api/ai/config                          → publica alterações da tela
 * POST /api/ai/test                            → sandbox (não envia WhatsApp)
 * POST /api/ai/conversations/:phone/pause      → operador assume a conversa
 * POST /api/ai/conversations/:phone/resume     → devolve a conversa para a IA
 */
import { Router } from 'express';
import { io } from '../index.js';
import { aiConfigured, aiRuntime, generateReply } from '../services/ai.js';
import { getAiConfig, saveAiConfig } from '../services/aiConfig.js';
import { pauseAi, resumeAi } from '../services/autoReply.js';

const router = Router();

router.get('/config', async (req, res) => {
  const config = await getAiConfig(req.account.id);
  res.json({ ...config, runtime: aiRuntime() });
});

router.put('/config', async (req, res) => {
  const patch = req.body;

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return res.status(400).json({ error: 'Corpo deve ser o objeto de configuração' });
  }

  // `runtime` é informativo (modelo/effort do servidor), não faz parte da config.
  // `calendar` tem rota própria (/api/google/settings): esta tela publica uma
  // cópia inteira da config e reverteria os ajustes de agenda.
  const { runtime, calendar, ...clean } = patch;

  const config = await saveAiConfig(req.account.id, clean);
  res.json({ ...config, runtime: aiRuntime() });
});

/**
 * Sandbox da tela de comportamento: roda a configuração que está na tela
 * (ainda não publicada) contra uma mensagem simulada.
 */
router.post('/test', async (req, res) => {
  const { message, config, history } = req.body || {};

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Campo "message" é obrigatório' });
  }

  if (!aiConfigured()) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY não configurada',
      note: 'Defina ANTHROPIC_API_KEY no backend/.env e reinicie o servidor.',
    });
  }

  const stored = await getAiConfig(req.account.id);
  const effective = config && typeof config === 'object'
    ? { ...stored, ...config }
    : stored;

  const turns = Array.isArray(history) ? history : [];

  try {
    const result = await generateReply({
      config: effective,
      history: [...turns, { direction: 'inbound', text: message }],
    });

    const tokens = result.usage
      ? `${result.usage.input_tokens ?? 0}/${result.usage.output_tokens ?? 0} tokens`
      : '';

    res.json({
      reply: result.reply,
      handoff: result.handoff,
      handoffReason: result.handoffReason,
      // O sandbox não grava lead nem dispara aviso: devolve só o que o modelo
      // coletaria, para conferir os campos antes de publicar.
      lead: result.lead,
      note: result.handoff
        ? `Handoff: ${result.handoffReason || 'sem motivo informado'}`
        : [result.model, aiRuntime().effort, tokens].filter(Boolean).join(' · '),
    });
  } catch (err) {
    console.error('Sandbox da IA falhou:', err.message);
    res.status(502).json({ error: err.message, note: 'Falha ao chamar a API do Claude' });
  }
});

router.post('/conversations/:phoneNumber/pause', async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  const meta = await pauseAi(io, req.account.id, req.params.phoneNumber, reason || undefined);
  res.json(meta);
});

router.post('/conversations/:phoneNumber/resume', async (req, res) => {
  const meta = await resumeAi(io, req.account.id, req.params.phoneNumber);
  res.json(meta);
});

export default router;
