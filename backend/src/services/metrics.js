/**
 * Métricas da conta, calculadas em cima do que já está gravado
 * (metadados das conversas + leads). Sem tabela de eventos própria: o volume
 * de uma conta cabe em memória e o cálculo é rápido.
 *
 * Consequência honesta disso: métrica que depende de histórico de eventos
 * (tempo de primeira resposta real, tempo de resolução) não sai daqui — só o
 * que os metadados guardam. Os campos abaixo são todos derivados de dados que
 * o produto de fato grava.
 */
import { listConversations, listLeads } from './store.js';

const DAY_MS = 86400000;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

const time = (iso) => {
  const t = new Date(iso || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Série diária dos últimos N dias: [{ day: '2026-07-31', conversations, leads }]
 * O eixo tem todos os dias, inclusive os vazios — senão o gráfico mente sobre
 * a distribuição.
 */
function daily(conversations, leads, days) {
  const start = startOfToday() - (days - 1) * DAY_MS;
  const buckets = new Map();

  for (let i = 0; i < days; i += 1) {
    const key = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    buckets.set(key, { day: key, conversations: 0, leads: 0 });
  }

  const bump = (iso, field) => {
    const t = time(iso);
    if (t < start) return;
    const bucket = buckets.get(new Date(t).toISOString().slice(0, 10));
    if (bucket) bucket[field] += 1;
  };

  conversations.forEach((c) => bump(c.firstTimestamp || c.lastTimestamp, 'conversations'));
  leads.filter((l) => l.complete).forEach((l) => bump(l.closedAt || l.updatedAt, 'leads'));

  return [...buckets.values()];
}

export async function computeMetrics(accountId, { days = 14 } = {}) {
  const [conversations, leads] = await Promise.all([
    listConversations(accountId),
    listLeads(accountId),
  ]);

  const today = startOfToday();
  const yesterday = today - DAY_MS;

  const closedLeads = leads.filter((l) => l.complete);
  const openLeads = leads.filter((l) => !l.complete);

  const activeToday = conversations.filter((c) => time(c.lastTimestamp) >= today);
  const activeYesterday = conversations.filter((c) => {
    const t = time(c.lastTimestamp);
    return t >= yesterday && t < today;
  });

  const escalated = conversations.filter((c) => c.needsHuman);
  const paused = conversations.filter((c) => c.aiPaused);
  const unread = conversations.reduce((n, c) => n + (c.unread || 0), 0);

  // "Resolvida pela IA" = conversa que nunca precisou de humano nem foi
  // assumida por um. É o que os metadados permitem afirmar.
  const aiOnly = conversations.filter((c) => !c.needsHuman && !c.aiPaused);

  const leadsToday = closedLeads.filter((l) => time(l.closedAt || l.updatedAt) >= today);

  const avgFill = leads.length
    ? Math.round(
      (leads.reduce((sum, l) => {
        const values = Object.values(l.fields || {});
        return sum + (values.length ? values.filter(Boolean).length / values.length : 0);
      }, 0) / leads.length) * 100,
    )
    : 0;

  return {
    generatedAt: new Date().toISOString(),

    conversations: {
      total: conversations.length,
      today: activeToday.length,
      yesterday: activeYesterday.length,
      unread,
      escalated: escalated.length,
      pausedByHuman: paused.length,
      resolvedByAi: aiOnly.length,
      resolvedByAiPct: pct(aiOnly.length, conversations.length),
    },

    leads: {
      closed: closedLeads.length,
      inProgress: openLeads.length,
      today: leadsToday.length,
      // Conversão sobre o total de conversas: quantas viraram lead completo
      conversionPct: pct(closedLeads.length, conversations.length),
      avgFillPct: avgFill,
      notified: closedLeads.filter((l) => l.closedAt).length,
    },

    series: daily(conversations, leads, days),

    // Últimos leads fechados, para a tabela da tela
    recentLeads: closedLeads.slice(0, 10).map((l) => ({
      phoneNumber: l.phoneNumber,
      fields: l.fields,
      labels: l.labels,
      closedAt: l.closedAt || l.updatedAt,
    })),
  };
}
