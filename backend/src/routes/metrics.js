/**
 * GET /api/metrics[?days=14]
 * Painel de métricas da conta logada.
 */
import { Router } from 'express';
import { computeMetrics } from '../services/metrics.js';

const router = Router();

router.get('/', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  res.json(await computeMetrics(req.account.id, { days }));
});

export default router;
