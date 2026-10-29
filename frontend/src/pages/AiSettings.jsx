import { useState } from 'react';
import {
  Hover, HOVER_MUTED, Switch, pill, MONO, card,
  btnPrimary, btnGhost, inputStyle, textareaStyle,
} from '../ui.jsx';
import { TONES, SANDBOX_PROMPTS } from '../data/defaults.js';

const TABS = [
  ['persona', 'Persona e tom'],
  ['rules', 'Limites e guardrails'],
  ['handoff', 'Horário e handoff'],
  ['leads', 'Coleta e leads'],
  ['sources', 'Fontes'],
];

/** Mesma normalização do backend (activeLeadFields em ai.js) */
function fieldKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function tabStyle(on) {
  return {
    height: 36, padding: '0 13px', border: 0,
    borderBottom: `2px solid ${on ? 'var(--fg)' : 'transparent'}`,
    background: 'transparent', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, color: on ? 'var(--fg)' : 'var(--mfg)',
  };
}

function toneStyle(on) {
  return {
    height: 30, padding: '0 12px',
    border: `1px solid ${on ? 'transparent' : 'var(--bd)'}`,
    borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
    background: on ? 'var(--pri)' : 'transparent',
    color: on ? 'var(--prifg)' : 'var(--fg)',
  };
}

const cardTitle = { fontSize: 14.5, fontWeight: 600 };
const cardSub = { fontSize: 12.5, color: 'var(--mfg)', marginTop: 3 };
const fieldLabel = { fontSize: 12.5, fontWeight: 500 };

function TopicChip({ text, onRemove }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
      border: '1px solid var(--bd)', background: 'var(--accsoft)',
      color: 'var(--accfg)', borderRadius: 7, padding: '4px 9px',
    }}>
      {text}
      <span style={{ cursor: 'pointer', opacity: .6 }} onClick={onRemove}>×</span>
    </span>
  );
}

export default function AiSettings({ ai, onChange, dirty, onPublish, onDiscard, authFetch, runtime }) {
  const [tab, setTab] = useState('persona');
  const [addingTopic, setAddingTopic] = useState(false);
  const [topic, setTopic] = useState('');
  const [sandbox, setSandbox] = useState([]);
  const [sbDraft, setSbDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const tempLabel = ai.temp < 30 ? 'conservadora' : ai.temp < 65 ? 'equilibrada' : 'solta';

  // Mesma conta do backend (typingDelay em autoReply.js), para uma resposta típica
  const typingPreview = (() => {
    const perChar = Number(ai.typingMsPerChar ?? 45);
    if (!(perChar > 0)) return '0.0';
    const min = Math.max(0, Number(ai.typingMinMs) || 0);
    const max = Math.max(min, Number(ai.typingMaxMs) || min);
    return (Math.min(Math.max(180 * perChar, min), max) / 1000).toFixed(1);
  })();

  function toggleGuard(k) {
    onChange({ guardrails: ai.guardrails.map(g => (g.k === k ? { ...g, on: !g.on } : g)) });
  }

  function toggleHandoff(k) {
    onChange({ handoffs: ai.handoffs.map(h => (h.k === k ? { ...h, on: !h.on } : h)) });
  }

  function addTopic() {
    const v = topic.trim();
    if (v) onChange({ allowed: [...ai.allowed, v] });
    setTopic('');
    setAddingTopic(false);
  }

  const leadFields = ai.leadFields || [];

  function patchField(k, patch) {
    onChange({ leadFields: leadFields.map(f => (f.k === k ? { ...f, ...patch } : f)) });
  }

  function addField() {
    const k = `f${Date.now().toString(36)}`;
    onChange({
      leadFields: [...leadFields, { k, on: true, key: '', label: '', desc: '', required: false }],
    });
  }

  function removeField(k) {
    onChange({ leadFields: leadFields.filter(f => f.k !== k) });
  }

  // Chave vazia herda o rótulo; duas chaves iguais viram uma só no schema
  const effectiveKey = f => fieldKey(f.key || f.label);
  const dupKeys = new Set(
    leadFields
      .filter(f => f.on)
      .map(effectiveKey)
      .filter((k, i, arr) => k && arr.indexOf(k) !== i),
  );

  /* O sandbox roda a configuração que está na tela (mesmo não publicada)
     contra o Claude, sem enviar nada pelo WhatsApp. O histórico da própria
     janela vai junto, então dá para testar handoff "após N tentativas". */
  async function runSandbox(text) {
    const q = text.trim();
    if (!q || busy) return;

    const history = sandbox.map(m => ({
      direction: m.t === 'in' ? 'inbound' : 'outbound',
      text: m.text,
    }));

    setSbDraft('');
    setSandbox(prev => [...prev, { t: 'in', text: q }]);
    setBusy(true);

    try {
      const res = await authFetch('/api/ai/test', {
        method: 'POST',
        body: JSON.stringify({ message: q, config: ai, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.note || data.error || `HTTP ${res.status}`);

      setSandbox(prev => [...prev, {
        t: 'out',
        text: data.reply,
        note: data.note || '',
        handoff: data.handoff,
        lead: data.lead || null,
      }]);
    } catch (err) {
      setSandbox(prev => [...prev, {
        t: 'out',
        text: 'Não consegui gerar a resposta agora.',
        note: err.message,
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header className="pg-headpad ai-head" style={{
        flex: 'none', padding: '20px 28px 0',
        borderBottom: '1px solid var(--bd)', background: 'var(--bg)',
      }}>
        <div className="wrap-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
              Comportamento da IA
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--mfg)', maxWidth: 640, textWrap: 'pretty' }}>
              Defina como a {ai.agentName} responde seus clientes no WhatsApp: personalidade,
              limites do que pode dizer e quando passar para um humano.
            </p>
          </div>
          <div className="pg-actions tap" style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
            <Hover
              style={{ ...btnGhost(34, 13), opacity: dirty ? 1 : .5 }}
              hoverStyle={dirty ? HOVER_MUTED : undefined}
              onClick={onDiscard}
              disabled={!dirty}
            >Descartar</Hover>
            <button style={{ ...btnPrimary(34, 15), opacity: dirty ? 1 : .5 }} onClick={onPublish} disabled={!dirty}>
              Publicar alterações
            </button>
          </div>
        </div>

        <div className="tabs-row" style={{ display: 'flex', gap: 2, marginTop: 16 }}>
          {TABS.map(([k, label]) => (
            <button key={k} style={tabStyle(tab === k)} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
      </header>

      <div className="ai-body" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div className="ai-main" style={{
          flex: 1, minWidth: 0, overflow: 'auto', padding: '22px 28px 40px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>

          {tab === 'persona' && (
            <>
              <div style={card}>
                <div style={{ padding: '16px 18px 0' }}>
                  <div style={cardTitle}>Persona</div>
                  <div style={cardSub}>Como a IA se apresenta e escreve.</div>
                </div>
                <div className="grid-2" style={{
                  padding: '16px 18px', display: 'grid',
                  gridTemplateColumns: '1fr 1fr', gap: 14,
                }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>Nome do agente</span>
                    <input
                      style={inputStyle}
                      value={ai.agentName}
                      onChange={e => onChange({ agentName: e.target.value })}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>Idioma</span>
                    <input
                      style={inputStyle}
                      value={ai.language}
                      onChange={e => onChange({ language: e.target.value })}
                    />
                  </label>
                  <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>Instruções de personalidade</span>
                    <textarea
                      rows={4}
                      style={textareaStyle}
                      value={ai.persona}
                      onChange={e => onChange({ persona: e.target.value })}
                    />
                  </label>
                  <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={fieldLabel}>Tom de voz</span>
                    <div className="tap" style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {TONES.map(t => (
                        <button key={t} style={toneStyle(ai.tone === t)} onClick={() => onChange({ tone: t })}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{
                ...card, padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div>
                  <div style={cardTitle}>Criatividade</div>
                  <div style={cardSub}>
                    Menor = respostas previsíveis e fiéis à base. Maior = mais liberdade de escrita.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <input
                    type="range" min="0" max="100" value={ai.temp}
                    onChange={e => onChange({ temp: +e.target.value })}
                    style={{ flex: 1, accentColor: 'var(--fg)' }}
                  />
                  <span style={{ width: 112, textAlign: 'right', fontSize: 12.5 }}>
                    <b style={{ fontFamily: MONO }}>{(ai.temp / 100).toFixed(2)}</b>{' '}
                    <span style={{ color: 'var(--mfg)' }}>{tempLabel}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: 'var(--mfg)' }}>
                  <span style={{ flex: 1 }}>Determinística</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>Equilibrada</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Criativa</span>
                </div>
              </div>

              <div style={card}>
                <div style={{
                  padding: '16px 18px', borderBottom: '1px solid var(--bd)',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <Switch
                    on={ai.typing !== false}
                    onChange={() => onChange({ typing: ai.typing === false })}
                    title="Simular digitação"
                  />
                  <div style={{ flex: 1 }}>
                    <div style={cardTitle}>Ritmo de resposta</div>
                    <div style={cardSub}>
                      Mostra “digitando…” no WhatsApp do cliente e espera antes de enviar.
                      O tempo cresce com o tamanho da resposta.
                    </div>
                  </div>
                </div>
                <div className="grid-3" style={{
                  padding: '16px 18px', display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
                  opacity: ai.typing === false ? .45 : 1,
                  pointerEvents: ai.typing === false ? 'none' : 'auto',
                }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>ms por caractere</span>
                    <input
                      type="number" min="0" max="500"
                      style={{ ...inputStyle, fontFamily: MONO }}
                      value={ai.typingMsPerChar ?? 45}
                      onChange={e => onChange({ typingMsPerChar: +e.target.value })}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>Espera mínima (ms)</span>
                    <input
                      type="number" min="0" max="60000"
                      style={{ ...inputStyle, fontFamily: MONO }}
                      value={ai.typingMinMs ?? 1500}
                      onChange={e => onChange({ typingMinMs: +e.target.value })}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={fieldLabel}>Espera máxima (ms)</span>
                    <input
                      type="number" min="0" max="60000"
                      style={{ ...inputStyle, fontFamily: MONO }}
                      value={ai.typingMaxMs ?? 8000}
                      onChange={e => onChange({ typingMaxMs: +e.target.value })}
                    />
                  </label>
                  <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--mfg)' }}>
                    Resposta de 180 caracteres:{' '}
                    <b style={{ fontFamily: MONO, color: 'var(--fg)' }}>{typingPreview}s</b>{' '}
                    de espera. Mínimo alto deixa a conversa lenta; máximo baixo
                    entrega respostas longas instantaneamente.
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'rules' && (
            <>
              <div style={card}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bd)' }}>
                  <div style={cardTitle}>Tópicos permitidos</div>
                  <div style={cardSub}>A IA só responde sozinha sobre estes assuntos.</div>
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {ai.allowed.map(a => (
                    <TopicChip
                      key={a}
                      text={a}
                      onRemove={() => onChange({ allowed: ai.allowed.filter(x => x !== a) })}
                    />
                  ))}
                  {addingTopic ? (
                    <input
                      autoFocus
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      onBlur={addTopic}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addTopic();
                        if (e.key === 'Escape') { setTopic(''); setAddingTopic(false); }
                      }}
                      placeholder="novo tópico"
                      style={{
                        fontSize: 12.5, border: '1px solid var(--bd)', background: 'var(--bg)',
                        borderRadius: 7, padding: '4px 10px', outline: 'none', width: 150,
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setAddingTopic(true)}
                      style={{
                        fontSize: 12.5, border: '1px dashed var(--bd)', background: 'transparent',
                        color: 'var(--mfg)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer',
                      }}
                    >+ adicionar</button>
                  )}
                </div>
              </div>

              <div style={card}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bd)' }}>
                  <div style={cardTitle}>Regras do que não fazer</div>
                  <div style={cardSub}>Bloqueios rígidos. Se acionados, a conversa vai para a fila humana.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {ai.guardrails.map(g => (
                    <div key={g.k} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '13px 18px', borderBottom: '1px solid var(--bd)',
                    }}>
                      <Switch on={g.on} onChange={() => toggleGuard(g.k)} title={g.title} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{g.title}</span>
                        <span style={{
                          display: 'block', fontSize: 12.5, color: 'var(--mfg)',
                          marginTop: 2, textWrap: 'pretty',
                        }}>{g.desc}</span>
                      </span>
                      <span style={pill(g.sev === 'Crítico' ? 'bad' : 'mut')}>{g.sev}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={fieldLabel}>Frases proibidas (a IA nunca escreve)</span>
                  <textarea
                    rows={3}
                    style={{ ...textareaStyle, fontFamily: MONO }}
                    value={ai.banned}
                    onChange={e => onChange({ banned: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'handoff' && (
            <>
              <div style={{
                ...card, padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div>
                  <div style={cardTitle}>Horário de atendimento</div>
                  <div style={cardSub}>Fora do horário a IA atende sozinha e agenda o retorno.</div>
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  border: '1px solid var(--bd)', borderRadius: 9, overflow: 'hidden',
                }}>
                  {ai.hours.map(h => (
                    <div key={h.day} className="row-wrap" style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 13px', borderBottom: '1px solid var(--bd)',
                    }}>
                      <span style={{ width: 120, fontSize: 13, fontWeight: 500 }}>{h.day}</span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--mfg)', fontFamily: MONO }}>{h.range}</span>
                      <span style={pill(h.k)}>{h.state}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bd)' }}>
                  <div style={cardTitle}>Quando avisar um humano</div>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--mfg)' }}>
                    A escalada acende o chip “Escalada” no inbox. Por padrão a IA
                    continua conduzindo a conversa até alguém assumir.
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {ai.handoffs.map(h => (
                    <div key={h.k} className="row-wrap" style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 18px', borderBottom: '1px solid var(--bd)',
                    }}>
                      <Switch on={h.on} onChange={() => toggleHandoff(h.k)} title={h.title} />
                      <span style={{ flex: 1, fontSize: 13 }}>{h.title}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--mfg)', fontFamily: MONO }}>{h.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bd)' }}>
                  <div style={cardTitle}>Quem pode parar a IA</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 18px', borderBottom: '1px solid var(--bd)',
                  }}>
                    <Switch
                      on={!!ai.handoffPauses}
                      onChange={() => onChange({ handoffPauses: !ai.handoffPauses })}
                      title="Escalada pausa a IA"
                    />
                    <span style={{ flex: 1, fontSize: 13 }}>
                      Escalada pausa a IA
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--mfg)' }}>
                        Desligado: escalar só avisa o time, a IA segue respondendo.
                      </span>
                    </span>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 18px', borderBottom: '1px solid var(--bd)',
                  }}>
                    <Switch
                      on={ai.pauseOnOperatorReply !== false}
                      onChange={() => onChange({
                        pauseOnOperatorReply: ai.pauseOnOperatorReply === false,
                      })}
                      title="Minha resposta pausa a IA"
                    />
                    <span style={{ flex: 1, fontSize: 13 }}>
                      Minha resposta pausa a IA
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--mfg)' }}>
                        Ao enviar uma mensagem você assume a conversa e a IA sai dela.
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'leads' && (
            <>
              <div style={card}>
                <div style={{
                  padding: '16px 18px', borderBottom: '1px solid var(--bd)',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <Switch
                    on={ai.leadCapture !== false}
                    onChange={() => onChange({ leadCapture: ai.leadCapture === false })}
                    title="Coletar dados do lead"
                  />
                  <div style={{ flex: 1 }}>
                    <div style={cardTitle}>Coleta de dados</div>
                    <div style={cardSub}>
                      Os campos ligados aqui entram no formato de saída do modelo — a IA
                      devolve os valores em campos separados, não em texto para adivinhar.
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 7,
                  opacity: ai.leadCapture === false ? .45 : 1,
                  pointerEvents: ai.leadCapture === false ? 'none' : 'auto',
                }}>
                  <span style={fieldLabel}>Objetivo da conversa</span>
                  <input
                    style={inputStyle}
                    placeholder="Ex.: agendar uma aula experimental gratuita"
                    value={ai.leadGoal || ''}
                    onChange={e => onChange({ leadGoal: e.target.value })}
                  />
                  <span style={{ fontSize: 12, color: 'var(--mfg)' }}>
                    Vai no prompt como o que a IA precisa conseguir na conversa.
                  </span>
                </div>
              </div>

              <div style={{
                ...card,
                opacity: ai.leadCapture === false ? .45 : 1,
                pointerEvents: ai.leadCapture === false ? 'none' : 'auto',
              }}>
                <div style={{
                  padding: '16px 18px', borderBottom: '1px solid var(--bd)',
                  display: 'flex', alignItems: 'center',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={cardTitle}>Campos coletados</div>
                    <div style={cardSub}>
                      Obrigatórios definem quando o lead fecha. Opcionais são coletados
                      se aparecerem na conversa.
                    </div>
                  </div>
                  <Hover
                    onClick={addField}
                    style={{ ...btnGhost(32, 13), background: 'transparent' }}
                    hoverStyle={HOVER_MUTED}
                  >+ Novo campo</Hover>
                </div>

                {leadFields.length === 0 && (
                  <div style={{ padding: '18px', fontSize: 12.5, color: 'var(--mfg)' }}>
                    Nenhum campo — a IA atende sem coletar nada estruturado.
                  </div>
                )}

                {leadFields.map(f => {
                  const key = effectiveKey(f);
                  const dup = f.on && dupKeys.has(key);

                  return (
                    <div key={f.k} className="lead-row" style={{
                      padding: '13px 18px', borderBottom: '1px solid var(--bd)',
                      display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto auto',
                      gap: 10, alignItems: 'center',
                    }}>
                      <Switch
                        on={!!f.on}
                        onChange={() => patchField(f.k, { on: !f.on })}
                        title={f.label || 'campo'}
                      />
                      <input
                        style={{ ...inputStyle, height: 32 }}
                        placeholder="Rótulo (ex.: Nome)"
                        value={f.label || ''}
                        onChange={e => patchField(f.k, { label: e.target.value })}
                      />
                      <input
                        style={{
                          ...inputStyle, height: 32, fontFamily: MONO, fontSize: 12,
                          borderColor: dup ? 'var(--danger)' : 'var(--bd)',
                        }}
                        placeholder={fieldKey(f.label) || 'chave_no_json'}
                        value={f.key || ''}
                        onChange={e => patchField(f.k, { key: e.target.value })}
                      />
                      <button
                        onClick={() => patchField(f.k, { required: !f.required })}
                        title="Alterna entre obrigatório e opcional"
                        style={{
                          ...pill(f.required ? 'bad' : 'mut'),
                          cursor: 'pointer', height: 24,
                        }}
                      >{f.required ? 'obrigatório' : 'opcional'}</button>
                      <span
                        onClick={() => removeField(f.k)}
                        title="Remover campo"
                        style={{ cursor: 'pointer', opacity: .5, padding: '0 4px', fontSize: 15 }}
                      >×</span>
                      <input
                        style={{
                          ...inputStyle, height: 30, gridColumn: '2/-1',
                          fontSize: 12, background: 'var(--muted2)',
                        }}
                        placeholder="O que a IA deve entender por esse campo (vai na descrição do schema)"
                        value={f.desc || ''}
                        onChange={e => patchField(f.k, { desc: e.target.value })}
                      />
                      {dup && (
                        <span style={{
                          gridColumn: '2/-1', fontSize: 11.5, color: 'var(--danger)',
                        }}>
                          Chave <code style={{ fontFamily: MONO }}>{key}</code> repetida —
                          só o primeiro campo com ela é enviado ao modelo.
                        </span>
                      )}
                      {!key && f.on && (
                        <span style={{
                          gridColumn: '2/-1', fontSize: 11.5, color: 'var(--warn)',
                        }}>
                          Sem rótulo nem chave: este campo é ignorado.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={card}>
                <div style={{
                  padding: '16px 18px', borderBottom: '1px solid var(--bd)',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <Switch
                    on={ai.notifyOnLead !== false}
                    onChange={() => onChange({ notifyOnLead: ai.notifyOnLead === false })}
                    title="Avisar quando um lead fechar"
                  />
                  <div style={{ flex: 1 }}>
                    <div style={cardTitle}>Aviso de lead fechado</div>
                    <div style={cardSub}>
                      Quando todos os obrigatórios estiverem preenchidos e confirmados,
                      chega uma mensagem no WhatsApp com os dados. Uma vez por conversa.
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 7,
                  opacity: ai.notifyOnLead === false ? .45 : 1,
                  pointerEvents: ai.notifyOnLead === false ? 'none' : 'auto',
                }}>
                  <span style={fieldLabel}>Número que recebe o aviso</span>
                  <input
                    style={{ ...inputStyle, fontFamily: MONO, maxWidth: 260 }}
                    placeholder="5511999990000"
                    value={ai.notifyPhone || ''}
                    onChange={e => onChange({ notifyPhone: e.target.value })}
                  />
                  <span style={{ fontSize: 12, color: 'var(--mfg)' }}>
                    Com código do país e DDD. Vazio: o lead é gravado e aparece no
                    painel, mas ninguém é avisado no WhatsApp.
                  </span>
                </div>
              </div>
            </>
          )}

          {tab === 'sources' && (
            <div style={card}>
              <div style={{
                padding: '16px 18px', borderBottom: '1px solid var(--bd)',
                display: 'flex', alignItems: 'center',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={cardTitle}>Base de conhecimento</div>
                  <div style={cardSub}>A IA só afirma o que estiver nestas fontes.</div>
                </div>
                <Hover
                  style={{ ...btnGhost(32, 13), background: 'transparent' }}
                  hoverStyle={HOVER_MUTED}
                >+ Nova fonte</Hover>
              </div>
              {ai.sources.map(s => (
                <div key={s.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 18px', borderBottom: '1px solid var(--bd)',
                }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: 7, background: 'var(--muted)',
                    display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--mfg)',
                  }}>{s.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--mfg)', marginTop: 1 }}>{s.meta}</span>
                  </span>
                  <span style={pill(s.k)}>{s.state}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* sandbox */}
        <aside className="ai-sandbox" style={{
          width: 376, flex: 'none', borderLeft: '1px solid var(--bd)',
          display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--muted2)',
        }}>
          <div style={{
            flex: 'none', padding: '14px 16px', borderBottom: '1px solid var(--bd)',
            background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Testar comportamento</span>
            <span
              title={runtime?.configured === false ? 'ANTHROPIC_API_KEY não configurada no backend' : undefined}
              style={{
                fontSize: 10.5, fontWeight: 500, color: 'var(--mfg)',
                border: '1px solid var(--bd)', borderRadius: 5, padding: '1px 6px',
                fontFamily: MONO,
              }}
            >{runtime?.model || 'sandbox'}</span>
            <span style={{ flex: 1 }} />
            <button
              onClick={() => setSandbox([])}
              style={{
                height: 26, padding: '0 9px', border: '1px solid var(--bd)',
                background: 'var(--card)', borderRadius: 6, fontSize: 11.5, cursor: 'pointer',
              }}
            >Limpar</button>
          </div>

          <div style={{
            flex: 1, overflow: 'auto', padding: 16,
            display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0,
          }}>
            {sandbox.map((m, i) => (m.t === 'in' ? (
              <div key={i} style={{
                maxWidth: '82%', alignSelf: 'flex-end', background: 'var(--pri)',
                color: 'var(--prifg)', borderRadius: '12px 12px 3px 12px',
                padding: '9px 12px', fontSize: 13, lineHeight: 1.5,
              }}>{m.text}</div>
            ) : (
              <div key={i} style={{
                maxWidth: '88%', alignSelf: 'flex-start',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <div style={{
                  background: 'var(--card)', border: '1px solid var(--bd)',
                  borderRadius: '12px 12px 12px 3px', padding: '9px 12px',
                  fontSize: 13, lineHeight: 1.5, boxShadow: 'var(--shadow)', textWrap: 'pretty',
                }}>{m.text}</div>
                {m.note && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mfg)' }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: 999,
                      background: m.handoff ? 'var(--warn)' : 'var(--mfg)',
                    }} />
                    {m.note}
                  </span>
                )}
                {m.lead && m.lead.total > 0 && (
                  <div style={{
                    border: '1px solid var(--bd)', borderRadius: 9, background: 'var(--card)',
                    padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--mfg)' }}>
                        COLETA {m.lead.filled}/{m.lead.total}
                      </span>
                      <span style={pill(m.lead.complete ? 'ok' : 'mut')}>
                        {m.lead.complete ? 'lead fechado' : 'em andamento'}
                      </span>
                    </span>
                    {Object.entries(m.lead.fields).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 11.5, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--mfg)', minWidth: 96 }}>
                          {m.lead.labels?.[k] || k}
                        </span>
                        <span style={{ color: v ? 'var(--fg)' : 'var(--mfg)', opacity: v ? 1 : .6 }}>
                          {v || '—'}
                        </span>
                      </span>
                    ))}
                    {m.lead.claimedComplete && !m.lead.complete && (
                      <span style={{ fontSize: 11, color: 'var(--warn)' }}>
                        A IA marcou como completo, mas falta: {m.lead.missing.join(', ')}.
                        O aviso não seria disparado.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )))}
          </div>

          <div style={{
            flex: 'none', padding: '12px 16px 16px', background: 'var(--bg)',
            borderTop: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SANDBOX_PROMPTS.map(p => (
                <Hover
                  key={p}
                  onClick={() => runSandbox(p)}
                  style={{
                    fontSize: 11.5, border: '1px solid var(--bd)', background: 'var(--card)',
                    borderRadius: 999, padding: '4px 10px', cursor: 'pointer', color: 'var(--mfg)',
                  }}
                  hoverStyle={HOVER_MUTED}
                >{p}</Hover>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={sbDraft}
                onChange={e => setSbDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSandbox(sbDraft)}
                placeholder="Simule uma mensagem do cliente…"
                style={{ ...inputStyle, flex: 1, background: 'var(--card)' }}
              />
              <button
                onClick={() => runSandbox(sbDraft)}
                disabled={busy}
                style={{ ...btnPrimary(36, 14), opacity: busy ? .6 : 1 }}
              >{busy ? '…' : 'Testar'}</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
