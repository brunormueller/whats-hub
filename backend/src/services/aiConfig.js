/**
 * Configuração de comportamento do agente (tela "Comportamento da IA").
 *
 * Uma configuração por conta (coleção `aiConfigs`, `_id` = accountId). O front
 * publica o objeto inteiro em PUT /api/ai/config; aqui ele é persistido e lido
 * pelo webhook a cada mensagem recebida. Os defaults abaixo espelham
 * AI_DEFAULTS do front — servem de fallback enquanto nada foi publicado.
 */
import { aiConfigs } from './mongo.js';
import { CALENDAR_DEFAULTS } from './googleCalendar.js';

export const AI_CONFIG_DEFAULTS = {
  // Liga/desliga a resposta automática (é o switch "IA ativa" do inbox)
  autoReply: true,

  // Escalada (handoff) cala a IA? Não: por padrão ela só avisa o time e segue
  // atendendo. Ligue para voltar ao comportamento de parar no handoff.
  handoffPauses: false,

  // Operador digitando na conversa pausa a IA naquele número — é o "a não ser
  // que eu pare": quem interrompe é o humano, não o modelo.
  pauseOnOperatorReply: true,

  // Ritmo humano: mostra "digitando…" e espera antes de enviar. O tempo é
  // proporcional ao tamanho da resposta, limitado pelo mínimo e pelo máximo.
  typing: true,
  typingMsPerChar: 45,
  typingMinMs: 1500,
  typingMaxMs: 8000,

  // Coleta estruturada. Os campos ativos entram no JSON schema da resposta do
  // modelo — não é tag em texto, então não existe parse frágil no meio.
  leadCapture: true,
  leadGoal: 'Agendar uma demonstração do produto com o time comercial',
  leadFields: [
    { k: 'f1', on: true, key: 'nome', label: 'Nome', desc: 'Como a pessoa quer ser chamada', required: true },
    { k: 'f2', on: true, key: 'interesse', label: 'Interesse', desc: 'O que ela procura, produto ou serviço de interesse', required: true },
    { k: 'f3', on: true, key: 'melhor_horario', label: 'Melhor horário', desc: 'Dia e horário combinados para o contato', required: true },
    { k: 'f4', on: false, key: 'email', label: 'E-mail', desc: 'E-mail de contato', required: false },
    { k: 'f5', on: false, key: 'empresa', label: 'Empresa', desc: 'Nome da empresa e porte, se houver', required: false },
  ],

  // Aviso no WhatsApp de quem cuida dos leads (vazio = só grava e avisa o painel)
  notifyOnLead: true,
  notifyPhone: '',

  // Resposta em áudio (exige o serviço de voz). mode: 'mirror' responde áudio
  // com áudio e texto com texto · 'always' · 'off'. `voice` é a voz do Kokoro.
  voice: { mode: 'mirror', voice: 'pf_dora' },

  // Agendamento no Google Calendar (a conexão da conta fica em googleConnections)
  calendar: { ...CALENDAR_DEFAULTS },

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

// Cache em memória por conta: evita uma leitura no banco por mensagem
// recebida. Invalidado na escrita, que é o único caminho de alteração.
const cache = new Map();

export async function getAiConfig(accountId) {
  if (!accountId) throw new Error('accountId é obrigatório para ler a configuração da IA');

  const cached = cache.get(accountId);
  if (cached) return cached;

  const doc = await aiConfigs().findOne({ _id: accountId }, { projection: { _id: 0 } });

  const config = { ...AI_CONFIG_DEFAULTS, ...(doc || {}) };
  cache.set(accountId, config);
  return config;
}

/** Mescla um patch (ou o objeto inteiro publicado pelo front) e persiste. */
export async function saveAiConfig(accountId, patch) {
  const current = await getAiConfig(accountId);
  const next = { ...current, ...patch };

  await aiConfigs().updateOne({ _id: accountId }, { $set: next }, { upsert: true });
  cache.set(accountId, next);

  return next;
}
