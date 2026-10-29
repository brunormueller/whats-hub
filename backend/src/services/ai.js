/**
 * Geração de respostas com a API da Anthropic (Claude).
 *
 * A configuração da tela "Comportamento da IA" vira o system prompt: persona,
 * tom, criatividade, tópicos permitidos, guardrails, frases proibidas, fontes,
 * horário e regras de handoff. A resposta volta em JSON estruturado
 * (output_config.format) para separar o texto enviado ao cliente do sinal de
 * "passar para um humano".
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
// WhatsApp é síncrono para o cliente, mas effort baixo devolvia respostas rasas
// que empurravam a conversa para o operador. Médio é o meio-termo.
const EFFORT = process.env.AI_EFFORT || 'medium';
// max_tokens limita raciocínio + texto. 4096 dá folga para uma resposta curta.
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 4096);
const TIMEZONE = process.env.AI_TIMEZONE || 'America/Sao_Paulo';
const HISTORY_LIMIT = Number(process.env.AI_HISTORY_LIMIT || 20);

/**
 * Campos de lead válidos e ligados, com a chave normalizada para virar
 * propriedade de JSON schema (sem acento, espaço nem maiúscula).
 */
export function activeLeadFields(config) {
  if (!config?.leadCapture) return [];

  const seen = new Set();

  return (config.leadFields || [])
    .filter((f) => f?.on)
    .map((f) => {
      const key = String(f.key || f.label || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      return { ...f, key, label: f.label || f.key || key };
    })
    .filter((f) => {
      if (!f.key || seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
}

/**
 * O schema muda com a configuração: os campos de lead ligados na tela viram
 * propriedades de `lead.fields`. Modo estrito da API exige todas as chaves em
 * `required`, então "ainda não sei" é string vazia, não campo ausente.
 */
function replySchema(leadFields, calendar = false) {
  const properties = {
    reply: {
      type: 'string',
      description: 'Mensagem a enviar no WhatsApp. Texto puro, sem markdown.',
    },
    handoff: {
      type: 'boolean',
      description:
        'true quando o time humano precisa ser avisado desta conversa. '
        + 'É um alerta, não o fim do atendimento: você continua respondendo.',
    },
    handoff_reason: {
      type: 'string',
      description: 'Motivo curto do handoff. String vazia quando handoff é false.',
    },
  };

  if (calendar) {
    properties.booking = {
      type: 'object',
      description:
        'Preencha SOMENTE na mensagem em que o cliente confirma um horário '
        + 'exato oferecido por você. Em qualquer outra, date e time vão vazios.',
      properties: {
        date: { type: 'string', description: 'Dia combinado, YYYY-MM-DD. Vazio se não há confirmação.' },
        time: { type: 'string', description: 'Hora combinada, HH:MM (24h). Vazio se não há confirmação.' },
      },
      required: ['date', 'time'],
      additionalProperties: false,
    };
  }

  if (leadFields.length) {
    const fields = {};

    for (const f of leadFields) {
      fields[f.key] = {
        type: 'string',
        description: [
          f.label,
          f.desc,
          'String vazia enquanto o cliente não informar. Nunca invente o valor.',
        ].filter(Boolean).join('. '),
      };
    }

    properties.lead = {
      type: 'object',
      description:
        'Dados coletados até agora nesta conversa. Repita em toda resposta os '
        + 'valores já obtidos antes — o que vier vazio é tratado como não coletado.',
      properties: {
        complete: {
          type: 'boolean',
          description:
            'true somente quando todos os campos obrigatórios estiverem '
            + 'preenchidos E o cliente tiver confirmado os dados.',
        },
        fields: {
          type: 'object',
          properties: fields,
          required: Object.keys(fields),
          additionalProperties: false,
        },
      },
      required: ['complete', 'fields'],
      additionalProperties: false,
    };
  }

  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

let client = null;

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Cliente preguiçoso: sem a chave o construtor lança, e isso derrubaria o
// servidor inteiro no import só porque a IA não foi configurada ainda.
function getClient() {
  if (!aiConfigured()) {
    throw new Error('ANTHROPIC_API_KEY não definida no .env');
  }
  if (!client) client = new Anthropic();
  return client;
}

export function aiRuntime() {
  return { model: MODEL, effort: EFFORT, configured: aiConfigured() };
}

/* ------------------------------------------------------------------ *
 * System prompt
 * ------------------------------------------------------------------ */

/**
 * O slider de criatividade vira instrução de texto: Claude Opus 5 (e os
 * demais modelos 5.x) rejeitam `temperature` com 400, então a intensidade
 * é expressa no prompt.
 */
function creativityRule(temp = 35) {
  if (temp < 30) {
    return 'Criatividade baixa: reutilize a formulação padrão da base, seja previsível '
      + 'e não improvise exemplos, números ou cenários.';
  }
  if (temp < 65) {
    return 'Criatividade equilibrada: adapte a formulação ao contexto do cliente, '
      + 'mas mantenha os fatos exatamente como estão na base.';
  }
  return 'Criatividade alta: varie livremente a formulação e o ritmo do texto, '
    + 'sem nunca alterar fatos, números ou condições comerciais.';
}

function list(items, fallback) {
  if (!items?.length) return fallback;
  return items.map((i) => `- ${i}`).join('\n');
}

export function buildSystemPrompt(config, { calendar = false } = {}) {
  const {
    agentName = 'Assistente',
    language = 'Português (BR)',
    persona = '',
    tone = 'Direto',
    temp = 35,
    allowed = [],
    guardrails = [],
    banned = '',
    hours = [],
    handoffs = [],
    sources = [],
    leadGoal = '',
  } = config || {};

  const leadFields = activeLeadFields(config);
  const requiredLead = leadFields.filter((f) => f.required);
  const activeGuards = guardrails.filter((g) => g.on);
  const activeHandoffs = handoffs.filter((h) => h.on);
  const activeSources = sources.filter((s) => s.state === 'Ativa');
  const blockedSources = sources.filter((s) => s.state !== 'Ativa');
  const bannedList = String(banned || '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  return [
    `# Papel
Você é ${agentName}, agente de atendimento de uma empresa no WhatsApp.
Escreva sempre em ${language}, mesmo que o cliente misture outro idioma.`,

    `# Personalidade
${persona || 'Atenda de forma cordial e objetiva.'}
Tom de voz: ${tone}.
${creativityRule(temp)}`,

    `# Formato da resposta
- É WhatsApp: mensagem enxuta e completa, até 900 caracteres.
- Texto puro. Nada de markdown, títulos, listas numeradas longas ou tabelas.
- Resolva o pedido inteiro de uma vez. Não fatie em migalhas nem devolva só
  "vou verificar": entregue agora tudo que já dá para entregar.
- No máximo uma pergunta por mensagem, e só quando faltar um dado para seguir.
- Não repita a saudação se a conversa já começou.`,

    `# Condução da conversa
Você conduz o atendimento do início ao fim, sozinha. Não devolva a conversa ao
operador nem espere aprovação humana para dar o próximo passo.
- Toda resposta avança: responde o que foi perguntado E já traz a próxima
  pergunta necessária ou o próximo passo combinado.
- Nunca encerre em espera passiva ("aguarde", "já retorno") antes de coletar
  tudo que o cliente pode informar agora.
- Se faltar um dado que só o time tem, siga com a parte que não depende dele e
  deixe pendente apenas o que falta.
- Cliente calado não é motivo para parar: retome o último ponto em aberto.`,

    leadFields.length
      ? `# Coleta de dados (lead)
${leadGoal ? `Objetivo da conversa: ${leadGoal}.\n` : ''}Colete estes dados ao longo do atendimento:
${leadFields.map((f) => `- ${f.label}${f.required ? ' (obrigatório)' : ' (opcional)'}${f.desc ? `: ${f.desc}` : ''}`).join('\n')}
Como coletar:
- Conversando, nunca como formulário. Uma pergunta por mensagem, encaixada na
  resposta que você já ia dar.
- Não peça de novo o que o cliente já informou nem o que dá para inferir da
  conversa (o número de WhatsApp, por exemplo, você já tem).
- Em toda resposta preencha \`lead.fields\` com TUDO que já sabe, repetindo os
  valores das mensagens anteriores. Campo que você ainda não tem fica com
  string vazia — nunca chute, nunca use "não informado" como valor.
- \`lead.complete\` só vira true quando ${requiredLead.length
        ? `${requiredLead.map((f) => f.label).join(', ')} estiver${requiredLead.length > 1 ? 'em' : ''} preenchido${requiredLead.length > 1 ? 's' : ''}`
        : 'os dados estiverem preenchidos'} E o cliente tiver confirmado. Confirme
  repetindo os dados em uma frase antes de marcar como completo.
- Depois de completo, siga atendendo normalmente e mantenha os campos
  preenchidos; se o cliente corrigir algo, atualize o valor.`
      : '',

    `# Assuntos que você resolve sozinha
${list(allowed, '- (nenhum assunto liberado — encaminhe tudo para um humano)')}
Assunto fora desta lista: não responda o mérito dele e marque handoff — mas
continue atendendo o resto da conversa normalmente.`,

    activeGuards.length
      ? `# Regras rígidas (nunca violar)
${activeGuards.map((g) => `- ${g.title}: ${g.desc}`).join('\n')}
Se atender o pedido exigir violar uma destas regras, não viole: marque handoff,
diga ao cliente que essa parte passa pelo time, e siga ajudando no que a regra
não bloqueia.`
      : '',

    bannedList.length
      ? `# Frases proibidas
Nunca escreva estas expressões, nem variações delas:
${bannedList.map((b) => `- "${b}"`).join('\n')}`
      : '',

    `# Base de conhecimento
${activeSources.length
      ? `Fontes ativas: ${activeSources.map((s) => s.name).join(', ')}.`
      : 'Nenhuma fonte ativa.'}
${blockedSources.length
      ? `Fontes bloqueadas (nunca cite nem use): ${blockedSources.map((s) => s.name).join(', ')}.`
      : ''}
Você não tem o conteúdo das fontes carregado nesta conversa. Afirme apenas o que
o próprio cliente informou ou o que estiver no histórico.
Dado que depende da base (preço, prazo, política, status): não invente e não
pare a conversa por causa dele. Colete antes tudo que o cliente pode informar
(pedido, CNPJ, e-mail, o que ele já tentou), adiante o que não depende da base,
avise em uma frase que o número exato vem do time e marque handoff.`,

    `# Horário de atendimento humano
${hours.map((h) => `- ${h.day}: ${h.range} → ${h.state}`).join('\n')}
Fora do horário de humanos você atende sozinha; se precisar de handoff, avise
que o time responde no próximo horário útil, sem prometer um horário exato.`,

    `# Quando avisar um humano (handoff)
handoff = true é um alerta para o time, NÃO o fim do atendimento. Você continua
respondendo o cliente na mesma mensagem e nas próximas, até um operador entrar
na conversa. Nunca escreva que vai "aguardar", "encerrar por aqui" ou parar.
Marque handoff = true quando qualquer destes ocorrer:
${activeHandoffs.length
      ? activeHandoffs.map((h) => `- ${h.title} (${h.value})`).join('\n')
      : '- (nenhuma regra ativa)'}
- O assunto está fora da lista de assuntos permitidos.
- Responder exigiria violar uma regra rígida ou inventar dado fora da base.
Quando o cliente pede um atendente humano explicitamente, avise que chamou o
time e siga adiantando o que der enquanto ele não chega.
Nos demais casos, o reply avisa em no máximo uma frase que o time foi acionado
e continua o atendimento. Não prometa prazo nem resultado.`,

    calendar
      ? `# Agenda
Você marca horários direto na agenda. Os horários livres de verdade chegam
no contexto operacional de cada mensagem ("Horários livres"); essa lista é a
única fonte de verdade sobre disponibilidade.
- Quando o cliente quiser agendar, ofereça 2 ou 3 opções tiradas dessa lista,
  em linguagem natural ("amanhã às 14h ou quinta às 10h"). Nunca ofereça nem
  aceite horário fora das janelas livres, e nunca invente disponibilidade.
- Se o cliente pedir um horário que não está livre, diga que não dá e ofereça
  os mais próximos que estão.
- Só quando o cliente confirmar UM horário exato, preencha booking.date e
  booking.time e responda confirmando dia e hora. O agendamento acontece
  depois da sua resposta: confirme com naturalidade, sem dizer "vou tentar".
- Se o contexto disser que já existe um agendamento, não crie outro (deixe
  booking vazio) e lembre o horário combinado. Pedido de remarcar ou cancelar:
  marque handoff e diga que vai ajustar manualmente.
- Os dias da semana e datas do contexto já estão no fuso certo: use-os como
  vieram.`
      : '',

    `# Precedência da personalidade
A seção Personalidade vale mais que qualquer menção a "time", "equipe",
"colega", "atendente" ou "operador" neste prompt. Se ela disser que você
trabalha sozinha, é a própria pessoa ou não tem equipe, então:
- Nunca fale em time, equipe, colega, setor, comercial ou atendente humano,
  nem diga que "avisou" ou "passou para" alguém.
- Onde este prompt mandaria avisar o time (fora do assunto, dado que depende
  da base, regra rígida), diga na primeira pessoa que você vai ver e retorna:
  "deixa eu ver isso e te falo". Sem prometer horário exato.
- Continue marcando handoff = true no JSON quando as regras mandarem: é só um
  alerta interno no painel e não aparece para o cliente.
Se a Personalidade não disser isso, ignore este bloco.`,

    `# Saída
Responda somente com o JSON do schema: reply (texto para o cliente),
handoff (booleano) e handoff_reason (motivo curto, ou string vazia)${leadFields.length
      ? ', mais lead.complete e lead.fields com os dados coletados'
      : ''}.`,
  ].filter(Boolean).join('\n\n');
}

/* ------------------------------------------------------------------ *
 * Chamada ao modelo
 * ------------------------------------------------------------------ */

/** Histórico do Redis → messages da API (inbound = user, outbound = assistant). */
function toMessages(history = []) {
  const mapped = history
    .filter((m) => typeof m?.text === 'string' && m.text.trim())
    .slice(-HISTORY_LIMIT)
    .map((m) => ({
      role: m.direction === 'outbound' ? 'assistant' : 'user',
      content: m.text,
    }));

  // A conversa precisa começar por uma mensagem do cliente
  while (mapped.length && mapped[0].role === 'assistant') mapped.shift();

  return mapped;
}

function runtimeContext(now, calendar) {
  const stamp = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  const base = `Contexto operacional (não repasse ao cliente): agora é ${stamp} (${TIMEZONE}). `
    + 'Use isso para decidir se o time humano está em horário de atendimento.';

  if (!calendar) return base;

  const booked = calendar.booked
    ? `\nJá existe agendamento desta conversa: ${calendar.booked}.`
    : '';

  return `${base}\nHorários livres (duração de ${calendar.durationMin} min cada atendimento):\n`
    + `${calendar.windows}${booked}`;
}

// O contexto volátil fica DEPOIS do breakpoint de cache: o system prompt é
// idêntico entre mensagens e é servido do cache.
function isSystemRoleRejected(err) {
  return err?.status === 400
    && /role/i.test(err?.message || '')
    && /system/i.test(err?.message || '');
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Gera a resposta do agente.
 *
 * @param {object}   params
 * @param {object}   params.config   configuração publicada na tela de comportamento
 * @param {Array}    params.history  mensagens da conversa (a última é a do cliente)
 * @returns {Promise<{reply: string, handoff: boolean, handoffReason: string, model: string, usage: object}>}
 */
export async function generateReply({ config, history = [], now = new Date(), calendar = null }) {
  const messages = toMessages(history);
  if (!messages.length) {
    throw new Error('Nenhuma mensagem do cliente para responder');
  }

  const contextText = runtimeContext(now, calendar);
  const lastIsClient = messages[messages.length - 1].role === 'user';
  const leadFields = activeLeadFields(config);

  const request = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{
      type: 'text',
      text: buildSystemPrompt(config, { calendar: Boolean(calendar) }),
      cache_control: { type: 'ephemeral' },
    }],
    output_config: {
      effort: EFFORT,
      format: { type: 'json_schema', schema: replySchema(leadFields, Boolean(calendar)) },
    },
    // Instrução de operador no fim do histórico: preserva o prefixo em cache
    // (mensagens de role "system" existem no Claude Opus 5 / 4.8 / Fable 5) e
    // ela precisa vir logo depois de um turno do cliente.
    messages: lastIsClient
      ? [...messages, { role: 'system', content: contextText }]
      : [...messages, { role: 'user', content: `[${contextText}]` }],
  };

  let response;
  try {
    response = await getClient().messages.create(request);
  } catch (err) {
    if (!lastIsClient || !isSystemRoleRejected(err)) throw err;

    // Modelo sem suporte a system message no meio da conversa: dobra o
    // contexto no último turno do cliente.
    const folded = messages.map((m, i) => (
      i === messages.length - 1
        ? { ...m, content: `${m.content}\n\n[${contextText}]` }
        : m
    ));
    response = await getClient().messages.create({ ...request, messages: folded });
  }

  if (response.stop_reason === 'refusal') {
    return {
      reply: 'Vou passar seu atendimento para um colega do time humano.',
      handoff: true,
      handoffReason: `Recusa de segurança do modelo (${response.stop_details?.category || 'sem categoria'})`,
      lead: null,
      model: response.model,
      usage: response.usage,
      stopReason: response.stop_reason,
    };
  }

  const text = response.content.find((b) => b.type === 'text')?.text || '';
  const parsed = safeParse(text);

  if (!parsed) {
    const cause = response.stop_reason === 'max_tokens'
      ? 'resposta truncada em max_tokens — aumente AI_MAX_TOKENS'
      : 'JSON inválido na resposta do modelo';
    throw new Error(`Não foi possível interpretar a resposta da IA: ${cause}`);
  }

  return {
    reply: String(parsed.reply || '').trim(),
    handoff: Boolean(parsed.handoff),
    handoffReason: String(parsed.handoff_reason || '').trim(),
    lead: readLead(parsed.lead, leadFields),
    booking: calendar ? readBooking(parsed.booking) : null,
    model: response.model,
    usage: response.usage,
    stopReason: response.stop_reason,
  };
}

/** Horário confirmado pelo cliente, ou null. Formato inválido vale como "sem confirmação". */
function readBooking(raw) {
  const date = String(raw?.date || '').trim();
  const time = String(raw?.time || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return { date, time };
}

/**
 * Normaliza o bloco `lead` da resposta: só campos configurados, valores
 * limpos, e `complete` reavaliado aqui — o modelo às vezes marca true com um
 * obrigatório ainda vazio, e a notificação não pode sair pela metade.
 */
function readLead(raw, leadFields) {
  if (!leadFields.length || !raw || typeof raw !== 'object') return null;

  const fields = {};
  for (const f of leadFields) {
    const value = raw.fields?.[f.key];
    fields[f.key] = typeof value === 'string' ? value.trim() : '';
  }

  const missing = leadFields
    .filter((f) => f.required && !fields[f.key])
    .map((f) => f.label);

  const filled = leadFields.filter((f) => fields[f.key]).length;

  return {
    complete: Boolean(raw.complete) && missing.length === 0,
    claimedComplete: Boolean(raw.complete),
    missing,
    filled,
    total: leadFields.length,
    fields,
    labels: Object.fromEntries(leadFields.map((f) => [f.key, f.label])),
  };
}
