import { useEffect, useRef } from 'react';
import { pill, MONO, shortTime } from '../ui.jsx';

const FILTERS = [
  ['minhas', 'Minhas'],
  ['ia', 'Com IA'],
  ['todas', 'Todas'],
];

const TAG_KIND = {
  'IA atendendo': 'ok',
  'Aguardando você': 'warn',
  'Resolvida': 'mut',
  'Escalada': 'bad',
  'Fora do horário': 'mut',
};

function filterStyle(on) {
  return {
    flex: 1, height: 26, border: 0, borderRadius: 6, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 500,
    background: on ? 'var(--card)' : 'transparent',
    color: on ? 'var(--fg)' : 'var(--mfg)',
    boxShadow: on ? 'var(--shadow)' : 'none',
  };
}

function itemStyle(on) {
  return {
    display: 'flex', gap: 11, width: '100%', textAlign: 'left',
    padding: '12px 16px', border: 0,
    borderLeft: `2px solid ${on ? 'var(--fg)' : 'transparent'}`,
    borderBottom: '1px solid var(--bd)',
    cursor: 'pointer',
    background: on ? 'var(--muted2)' : 'transparent',
    color: 'var(--fg)',
  };
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

export default function ConversationList({
  conversations, selected, onSelect, filter, onFilter, query, onQuery,
}) {
  const searchRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section style={{
      width: 352, flex: 'none', borderRight: '1px solid var(--bd)',
      display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      <div style={{
        padding: '14px 16px 10px', display: 'flex', flexDirection: 'column',
        gap: 10, borderBottom: '1px solid var(--bd)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-.01em' }}>Conversas</h1>
          <span style={{ fontSize: 11.5, color: 'var(--mfg)', fontFamily: MONO }}>
            {conversations.length} abertas
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 34,
          border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--muted2)',
        }}>
          <span style={{ color: 'var(--mfg)', fontSize: 13 }}>⌕</span>
          <input
            ref={searchRef}
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontSize: 13, minWidth: 0 }}
          />
          <span style={{
            fontFamily: MONO, fontSize: 10, color: 'var(--mfg)',
            border: '1px solid var(--bd)', borderRadius: 4, padding: '1px 4px',
          }}>⌘K</span>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--muted)', borderRadius: 8 }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} style={filterStyle(filter === k)} onClick={() => onFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {conversations.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--mfg)', fontSize: 13, lineHeight: 1.6 }}>
            Nenhuma conversa neste filtro.<br />Aguardando mensagens…
          </div>
        )}

        {conversations.map(c => (
          <button
            key={c.phoneNumber}
            style={itemStyle(c.phoneNumber === selected)}
            onClick={() => onSelect(c.phoneNumber)}
          >
            <span style={{
              width: 38, height: 38, flex: 'none', borderRadius: 999, background: 'var(--muted)',
              display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--mfg)',
            }}>{c.initials}</span>

            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, ...ellipsis }}>{c.name}</span>
                <span style={{ fontSize: 11, color: 'var(--mfg)', flex: 'none' }}>{shortTime(c.lastTimestamp)}</span>
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--mfg)', ...ellipsis }}>
                  {c.lastMessage || '…'}
                </span>
                {c.unread > 0 && (
                  <span style={{
                    flex: 'none', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                    background: 'var(--acc)', color: '#04241c', fontSize: 10.5, fontWeight: 600,
                    display: 'grid', placeItems: 'center',
                  }}>{c.unread}</span>
                )}
              </span>

              <span style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                <span style={pill(TAG_KIND[c.tag] || 'mut')}>{c.tag}</span>
                <span style={{
                  fontSize: 10.5, color: 'var(--mfg)', border: '1px solid var(--bd)',
                  borderRadius: 5, padding: '1px 6px',
                }}>{c.queue}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
