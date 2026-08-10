/**
 * Conteúdo inicial das telas do design "Atende IA".
 *
 * AI_DEFAULTS  → configuração editável do agente (vira estado local da tela).
 * TEAM_DEMO    → placeholder: não existe endpoint de equipe/filas no backend.
 *                Trocar por /api/team quando a rota existir. As métricas do
 *                topo dessa tela são fictícias — as reais estão em "Painel"
 *                (/api/metrics).
 */

export const QUEUES = ['Suporte', 'Comercial', 'Financeiro'];

export const AI_DEFAULTS = {
  // Espelham os defaults do backend (aiConfig.js)
  handoffPauses: false,
  pauseOnOperatorReply: true,

  typing: true,
  typingMsPerChar: 45,
  typingMinMs: 1500,
  typingMaxMs: 8000,

  leadCapture: true,
  leadGoal: 'Agendar uma demonstração do produto com o time comercial',
  leadFields: [
    { k: 'f1', on: true, key: 'nome', label: 'Nome', desc: 'Como a pessoa quer ser chamada', required: true },
    { k: 'f2', on: true, key: 'interesse', label: 'Interesse', desc: 'O que ela procura, produto ou serviço de interesse', required: true },
    { k: 'f3', on: true, key: 'melhor_horario', label: 'Melhor horário', desc: 'Dia e horário combinados para o contato', required: true },
    { k: 'f4', on: false, key: 'email', label: 'E-mail', desc: 'E-mail de contato', required: false },
    { k: 'f5', on: false, key: 'empresa', label: 'Empresa', desc: 'Nome da empresa e porte, se houver', required: false },
  ],

  notifyOnLead: true,
  notifyPhone: '',

  agentName: 'Nina',
  language: 'Português (BR)',
  persona:
    'Você é a Nina, do suporte da Nexo. Fale de forma direta, cordial e objetiva. '
    + 'Até 5 frases por resposta, sem encher linguiça. Nunca use emojis. '
    + 'Confirme o dado antes de executar uma ação, mas não peça permissão para '
    + 'continuar o atendimento: conduza até resolver ou até um humano entrar.',
  tone: 'Direto',
  temp: 35,
  guardrails: [
    { k: 'g1', on: true, title: 'Nunca prometer resultado ou garantia', desc: 'Bloqueia frases como "garantimos", "com certeza" e promessas de desempenho.', sev: 'Crítico' },
    { k: 'g2', on: true, title: 'Não falar de preço fora da tabela', desc: 'Descontos e condições especiais só com aprovação humana.', sev: 'Crítico' },
    { k: 'g3', on: true, title: 'Não pedir dados sensíveis', desc: 'Cartão, senha, CPF completo e documentos nunca por WhatsApp.', sev: 'Crítico' },
    { k: 'g4', on: false, title: 'Não comentar concorrentes', desc: 'Redireciona para os diferenciais do produto.', sev: 'Médio' },
    { k: 'g5', on: true, title: 'Não inventar fora da base', desc: 'Se não houver fonte, a IA diz que vai confirmar com o time.', sev: 'Crítico' },
  ],
  banned: 'garantimos, sem risco, com certeza, prometo que, é obrigatório',
  allowed: [
    'Dúvidas de produto', 'Status de pedido', '2ª via de boleto',
    'Horário e prazos', 'Agendamento de demo', 'FAQ de integrações',
  ],
  hours: [
    { day: 'Seg – Sex', range: '08:00 – 18:00', state: 'Humanos', k: 'ok' },
    { day: 'Sábado', range: '09:00 – 13:00', state: 'Só IA', k: 'mut' },
    { day: 'Domingo', range: '—', state: 'Só IA', k: 'mut' },
    { day: 'Feriados', range: '—', state: 'Só IA', k: 'mut' },
  ],
  handoffs: [
    { k: 'h1', on: true, title: 'Cliente pede para falar com atendente', value: 'imediato' },
    { k: 'h2', on: true, title: 'IA não resolve após N tentativas', value: '2 tentativas' },
    { k: 'h3', on: true, title: 'Sentimento negativo detectado', value: 'nível alto' },
    { k: 'h4', on: false, title: 'Conversa com mais de N minutos', value: '15 min' },
  ],
  sources: [
    { name: 'Central de ajuda', meta: '142 artigos · sincronizado há 2h', state: 'Ativa', icon: '▤', k: 'ok' },
    { name: 'Tabela de preços 2026', meta: 'PDF · 4 páginas', state: 'Ativa', icon: '▦', k: 'ok' },
    { name: 'Políticas de cancelamento', meta: 'Documento · atualizado em 12/07', state: 'Ativa', icon: '▧', k: 'ok' },
    { name: 'Roadmap interno', meta: 'Notion · acesso restrito', state: 'Bloqueada', icon: '▩', k: 'bad' },
  ],
};

export const TONES = ['Direto', 'Cordial', 'Formal', 'Informal', 'Consultivo'];

export const SANDBOX_PROMPTS = ['pedir desconto', 'quero cancelar', 'falar com humano'];

/* --- placeholder até existir backend de equipe --- */
export const TEAM_DEMO = {
  stats: [
    { k: 'Conversas hoje', v: '318', sub: '+12% vs. ontem' },
    { k: 'Resolvidas pela IA', v: '71%', sub: '226 de 318' },
    { k: 'Tempo 1ª resposta', v: '8s', sub: 'mediana' },
    { k: 'Escaladas', v: '34', sub: '11% do volume' },
  ],
  people: [
    { name: 'Marina Rocha', initials: 'MR', email: 'marina@nexo.com.br', queues: 'Suporte, Financeiro', role: 'Atendente', today: 42, status: 'Online', on: 1 },
    { name: 'Caio Pestana', initials: 'CP', email: 'caio@nexo.com.br', queues: 'Comercial', role: 'Atendente', today: 31, status: 'Online', on: 1 },
    { name: 'Júlia Sanches', initials: 'JS', email: 'julia@nexo.com.br', queues: 'Todas', role: 'Supervisor', today: 12, status: 'Ausente', on: 0 },
    { name: 'Eduardo Lins', initials: 'EL', email: 'eduardo@nexo.com.br', queues: 'Financeiro', role: 'Atendente', today: 27, status: 'Online', on: 1 },
    { name: 'Paula Verdi', initials: 'PV', email: 'paula@nexo.com.br', queues: 'Todas', role: 'Admin', today: 3, status: 'Offline', on: 0 },
  ],
  queues: [
    { name: 'Suporte', desc: 'Dúvidas técnicas e incidentes', people: '3 pessoas', ai: 'IA ativa', k: 'ok' },
    { name: 'Comercial', desc: 'Novos leads e upgrades', people: '2 pessoas', ai: 'IA ativa', k: 'ok' },
    { name: 'Financeiro', desc: 'Boletos, notas e cobranças', people: '2 pessoas', ai: 'IA só triagem', k: 'warn' },
  ],
};
