import { useState } from 'react';
import { Hover, HOVER_MUTED, Switch, MONO, sectionLabel } from '../ui.jsx';

const row = { display: 'flex', justifyContent: 'space-between', fontSize: 12.5 };

export default function ContactPanel({
  conversation, aiEnabled, onToggleAi, ai, onGoSettings,
  labels, onAddLabel, channelPhone,
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  if (!conversation) return null;

  const handoff = ai.handoffs.find(h => h.k === 'h2');

  const details = [
    { k: 'Empresa', v: conversation.company || '—' },
    { k: 'Plano', v: conversation.plan || '—' },
    { k: 'Cliente desde', v: conversation.since || '—' },
    { k: 'Fila', v: conversation.queue },
    { k: 'Canal', v: channelPhone || '—' },
  ];

  function commitLabel() {
    const v = value.trim();
    if (v) onAddLabel(v);
    setValue('');
    setAdding(false);
  }

  return (
    <aside style={{
      width: 296, flex: 'none', borderLeft: '1px solid var(--bd)', overflow: 'auto',
      padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 8, padding: '6px 0 10px',
      }}>
        <span style={{
          width: 56, height: 56, borderRadius: 999, background: 'var(--muted)',
          display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 600, color: 'var(--mfg)',
        }}>{conversation.initials}</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{conversation.name}</span>
        <span style={{ fontSize: 12, color: 'var(--mfg)', fontFamily: MONO }}>{conversation.phone}</span>
      </div>

      <div style={{
        border: '1px solid var(--bd)', borderRadius: 10,
        background: 'var(--card)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '11px 13px', borderBottom: '1px solid var(--bd)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Agente de IA</span>
          <span style={{ flex: 1 }} />
          <Switch on={aiEnabled} onChange={onToggleAi} title={aiEnabled ? 'Pausar IA' : 'Ativar IA'} />
        </div>
        <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={row}>
            <span style={{ color: 'var(--mfg)' }}>Persona</span>
            <span style={{ fontWeight: 500 }}>{`${ai.agentName} · ${ai.tone}`}</span>
          </div>
          <div style={row}>
            <span style={{ color: 'var(--mfg)' }}>Confiança</span>
            <span style={{ fontWeight: 500, color: 'var(--accfg)' }}>—</span>
          </div>
          <div style={row}>
            <span style={{ color: 'var(--mfg)' }}>Handoff em</span>
            <span style={{ fontWeight: 500 }}>{handoff?.on ? handoff.value : 'desativado'}</span>
          </div>
          <Hover
            onClick={onGoSettings}
            style={{
              marginTop: 2, height: 30, border: '1px solid var(--bd)', background: 'transparent',
              borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            }}
            hoverStyle={HOVER_MUTED}
          >Ajustar comportamento</Hover>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={sectionLabel}>Detalhes</span>
        {details.map(d => (
          <div key={d.k} style={{
            display: 'flex', justifyContent: 'space-between', gap: 12,
            fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--bd)',
          }}>
            <span style={{ color: 'var(--mfg)' }}>{d.k}</span>
            <span style={{ fontWeight: 500, textAlign: 'right' }}>{d.v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={sectionLabel}>Etiquetas</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {labels.map(l => (
            <span key={l} style={{
              fontSize: 11.5, border: '1px solid var(--bd)', background: 'var(--muted)',
              borderRadius: 6, padding: '3px 8px',
            }}>{l}</span>
          ))}

          {adding ? (
            <input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') { setValue(''); setAdding(false); }
              }}
              placeholder="nova etiqueta"
              style={{
                fontSize: 11.5, border: '1px solid var(--bd)', background: 'var(--bg)',
                borderRadius: 6, padding: '3px 8px', outline: 'none', width: 110,
              }}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{
                fontSize: 11.5, border: '1px dashed var(--bd)', background: 'transparent',
                borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--mfg)',
              }}
            >+ etiqueta</button>
          )}
        </div>
      </div>
    </aside>
  );
}
