import { useState, useEffect, useRef, Fragment } from 'react';
import {
  Hover, HOVER_MUTED, pill, MONO, btnGhost, btnPrimary,
  clockTime, dayLabel, dayKey,
} from '../ui.jsx';
import { QUEUES } from '../data/defaults.js';

const wrap = {
  flex: 1, minWidth: 440, display: 'flex', flexDirection: 'column',
  minHeight: 0, background: 'var(--muted2)',
};

function DaySeparator({ iso }) {
  return (
    <div style={{
      alignSelf: 'center', fontSize: 11, color: 'var(--mfg)',
      background: 'var(--muted)', borderRadius: 999, padding: '3px 12px',
    }}>{dayLabel(iso)}</div>
  );
}

function Incoming({ msg }) {
  return (
    <div style={{ maxWidth: '62%', alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--bd)',
        borderRadius: '12px 12px 12px 3px', padding: '9px 13px',
        fontSize: 13.5, lineHeight: 1.5, boxShadow: 'var(--shadow)', textWrap: 'pretty',
      }}>{msg.text}</div>
      <span style={{ fontSize: 10.5, color: 'var(--mfg)', paddingLeft: 3 }}>{clockTime(msg.timestamp)}</span>
    </div>
  );
}

function Outgoing({ msg }) {
  const ai = !!msg.ai || msg.label === 'IA';
  return (
    <div style={{
      maxWidth: '62%', alignSelf: 'flex-end', display: 'flex',
      flexDirection: 'column', gap: 4, alignItems: 'flex-end',
    }}>
      <div style={{
        background: ai ? 'var(--muted)' : 'var(--pri)',
        color: ai ? 'var(--fg)' : 'var(--prifg)',
        border: `1px solid ${ai ? 'var(--bd)' : 'transparent'}`,
        borderRadius: '12px 12px 3px 12px', padding: '9px 13px',
        fontSize: 13.5, lineHeight: 1.5, textWrap: 'pretty',
      }}>{msg.text}</div>
      <span style={{ fontSize: 10.5, color: 'var(--mfg)', paddingRight: 3 }}>
        {`${ai ? 'IA' : (msg.agent || 'Você')} · ${clockTime(msg.timestamp)}`}
      </span>
    </div>
  );
}

function SystemLine({ msg }) {
  return (
    <div style={{
      alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 11.5, color: 'var(--mfg)', background: 'var(--muted)',
      border: '1px solid var(--bd)', borderRadius: 999, padding: '4px 12px',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--warn)' }} />
      {msg.text}
    </div>
  );
}

export default function ChatWindow({
  conversation, messages, onSend, aiEnabled,
  onPauseConv, onResumeConv, onResolve, onTransfer,
}) {
  const [draft, setDraft] = useState('');
  const [showSug, setShowSug] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setDraft(''); setShowSug(true); setTransferOpen(false); }, [conversation?.phoneNumber]);

  if (!conversation) {
    return (
      <section style={wrap}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 10,
          alignItems: 'center', justifyContent: 'center', color: 'var(--mfg)', fontSize: 13,
        }}>
          <span style={{ fontSize: 30 }}>▤</span>
          <span>Selecione uma conversa para começar</span>
        </div>
      </section>
    );
  }

  /* Estado da IA nesta conversa. O switch global manda, mas o operador pode
     assumir só este número (aiPaused). Escalada (needsHuman) não pausa nada:
     é aviso ao time e a IA segue respondendo. */
  const convPaused = !!conversation.aiPaused;
  const aiOn = aiEnabled && !convPaused;
  const escalated = !!conversation.needsHuman && !convPaused;

  /* Sugestão da IA: só aparece quando o backend anexa `suggestion`
     à última mensagem recebida. */
  const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');
  const suggestion = showSug && aiEnabled ? (lastInbound?.suggestion || '') : '';

  function send() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  let lastDay = null;

  return (
    <section style={wrap}>
      <header style={{
        height: 60, flex: 'none', padding: '0 18px', display: 'flex',
        alignItems: 'center', gap: 12, borderBottom: '1px solid var(--bd)', background: 'var(--bg)',
      }}>
        <span style={{
          width: 34, height: 34, borderRadius: 999, background: 'var(--muted)',
          display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--mfg)',
        }}>{conversation.initials}</span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>
            {conversation.name}
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--mfg)', fontFamily: MONO }}>
            {conversation.phone}
          </span>
        </span>

        <span style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
          <span style={pill(aiOn ? (escalated ? 'warn' : 'ok') : 'mut')}>
            <span style={{
              width: 6, height: 6, borderRadius: 999, background: 'currentColor',
              animation: 'dcpulse 2s ease-in-out infinite',
            }} />
            {aiOn
              ? (escalated ? 'IA respondendo · escalada' : 'IA respondendo')
              : (convPaused ? 'Você assumiu' : 'IA pausada')}
          </span>

          <Hover
            style={btnGhost(32, 12)}
            hoverStyle={HOVER_MUTED}
            onClick={() => setTransferOpen(o => !o)}
          >Transferir</Hover>

          <Hover
            style={btnGhost(32, 12)}
            hoverStyle={HOVER_MUTED}
            onClick={onResolve}
          >Resolver</Hover>

          {transferOpen && (
            <div style={{
              position: 'absolute', top: 40, right: 0, zIndex: 20, minWidth: 168,
              border: '1px solid var(--bd)', background: 'var(--card)', borderRadius: 8,
              padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,.10)',
            }}>
              {QUEUES.map(q => (
                <Hover
                  key={q}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', border: 0, background: 'transparent',
                    borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  }}
                  hoverStyle={HOVER_MUTED}
                  onClick={() => { onTransfer(q); setTransferOpen(false); }}
                >
                  <span style={{ flex: 1 }}>{q}</span>
                  <span style={{ color: 'var(--acc)', fontSize: 12 }}>
                    {conversation.queue === q ? '✓' : ''}
                  </span>
                </Hover>
              ))}
            </div>
          )}
        </span>
      </header>

      {escalated && (
        <div style={{
          flex: 'none', padding: '8px 22px', display: 'flex', alignItems: 'center',
          gap: 10, fontSize: 12.5, background: 'var(--muted)',
          borderBottom: '1px solid var(--bd)',
        }}>
          <span style={pill('warn')}>Escalada</span>
          <span style={{ flex: 1, minWidth: 0, color: 'var(--mfg)' }}>
            {`${conversation.handoffReason || 'A IA pediu apoio do time'} — ela segue atendendo até você assumir.`}
          </span>
          <Hover style={btnGhost(28, 12)} hoverStyle={HOVER_MUTED} onClick={onPauseConv}>
            Assumir agora
          </Hover>
        </div>
      )}

      <div style={{
        flex: 1, overflow: 'auto', padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0,
      }}>
        {messages.map(msg => {
          const k = dayKey(msg.timestamp);
          const newDay = k !== lastDay;
          lastDay = k;
          return (
            <Fragment key={msg.id}>
              {newDay && <DaySeparator iso={msg.timestamp} />}
              {msg.direction === 'inbound' && <Incoming msg={msg} />}
              {msg.direction === 'outbound' && <Outgoing msg={msg} />}
              {msg.direction === 'system' && <SystemLine msg={msg} />}
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{
        flex: 'none', padding: '12px 18px 16px',
        background: 'var(--bg)', borderTop: '1px solid var(--bd)',
      }}>
        {suggestion && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10,
            padding: '10px 12px', border: '1px dashed var(--bd)',
            background: 'var(--accsoft)', borderRadius: 9,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '.05em', color: 'var(--accfg)',
              border: '1px solid currentColor', borderRadius: 5, padding: '1px 5px', marginTop: 1,
            }}>IA</span>
            <span style={{ flex: 1, fontSize: 13, lineHeight: 1.45, color: 'var(--accfg)', textWrap: 'pretty' }}>
              {suggestion}
            </span>
            <button
              onClick={() => { setDraft(suggestion); setShowSug(false); }}
              style={{
                flex: 'none', height: 26, padding: '0 10px', border: 0,
                background: 'var(--pri)', color: 'var(--prifg)', borderRadius: 6,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >Usar</button>
            <button
              onClick={() => setShowSug(false)}
              style={{
                flex: 'none', height: 26, width: 26, border: 0, background: 'transparent',
                color: 'var(--accfg)', borderRadius: 6, fontSize: 14, cursor: 'pointer',
              }}
            >×</button>
          </div>
        )}

        <div style={{
          border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--card)',
          padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <textarea
            rows={2}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Escreva uma mensagem…  /  para atalhos"
            style={{
              border: 0, outline: 'none', resize: 'none', background: 'transparent',
              fontSize: 13.5, lineHeight: 1.5, width: '100%', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: 'var(--mfg)' }}>Enter envia · Shift+Enter quebra linha</span>
            <span style={{ flex: 1 }} />
            <button
              onClick={convPaused ? onResumeConv : onPauseConv}
              title={!aiEnabled && convPaused
                ? 'O switch global "Agente de IA" também está desligado'
                : undefined}
              style={{
                height: 30, padding: '0 12px', border: '1px solid var(--bd)',
                background: 'transparent', color: 'var(--mfg)', borderRadius: 7,
                fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              }}
            >{convPaused ? 'Reativar IA' : 'Assumir conversa'}</button>
            <button onClick={send} style={btnPrimary(30, 14)}>Enviar</button>
          </div>
        </div>
      </div>
    </section>
  );
}
