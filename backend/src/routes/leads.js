/**
 * Leads coletados pela IA.
 *
 * GET /api/leads            → todos, mais recentes primeiro
 * GET /api/leads/:phone     → o lead de uma conversa
 */
import { Router } from 'express';
import { listLeads, getLead } from '../services/redis.js';

const router = Router();

router.get('/', async (req, res) => {
  const leads = await listLeads(req.account.id);
  const onlyClosed = String(req.query.complete || '') === 'true';

  res.json(onlyClosed ? leads.filter((l) => l.complete) : leads);
});

router.get('/:phoneNumber', async (req, res) => {
  const lead = await getLead(req.account.id, req.params.phoneNumber);
  if (!lead) return res.status(404).json({ error: 'Nenhum lead nesta conversa' });
  res.json(lead);
});

export default router;
