import { useState } from 'react';
import { Hover, HOVER_MUTED, pill, MONO, card, btnPrimary, btnGhost, clockTime } from '../ui.jsx';

const STATE_PILL = {
  open: ['Conectado', 'ok'],
  connecting: ['Reconectando', 'warn'],
  close: ['Desconectado', 'bad'],
  not_found: ['Não pareado', 'warn'],
  error: ['Erro', 'bad'],
  disabled: ['Cloud API', 'ok'],
  loading: ['Verificando…', 'mut'],
};

export default function Channels({
  instanceState, channelPhone, conversationCount, aiEnabled, log,
  onConnect, onConfigure,
}) {
  const [showLog, setShowLog] = useState(false);
  const [state, kind] = STATE_PILL[instanceState] || STATE_PILL.loading;

  const channels = [{
    name: 'WhatsApp principal',
    phone: channelPhone || '—',
    icon: 'W',
    state,
    kind,
    metrics: [
      { k: 'Conversas', v: String(conversationCount) },
      { k: 'Resposta média', v: '—' },
      { k: 'IA ativa', v: aiEnabled ? 'Sim' : 'Não' },
    ],
  }];

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px 40px' }}>
      <div style={{ maxWidth: 1080, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
              Canais
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--mfg)' }}>
              Números de WhatsApp conectados a este workspace.
            </p>
          </div>
          <button style={btnPrimary(34, 15)} onClick={onConnect}>Conectar número</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {channels.map(c => (
            <div key={c.name} style={{
              ...card, padding: '16px 17px',
              display: 'flex', flexDirection: 'column', gap: 13,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 9, background: 'var(--muted)',
                  display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--mfg)',
                }}>{c.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                  <span style={{
                    display: 'block', fontSize: 12.5, color: 'var(--mfg)',
                    fontFamily: MONO, marginTop: 2,
                  }}>{c.phone}</span>
                </span>
                <span style={pill(c.kind)}>{c.state}</span>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10,
                paddingTop: 2, borderTop: '1px solid var(--bd)',
              }}>
                {c.metrics.map(m => (
                  <span key={m.k} style={{ paddingTop: 10 }}>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--mfg)' }}>{m.k}</span>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, marginTop: 2 }}>{m.v}</span>
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Hover
                  style={{ ...btnGhost(31, 12), background: 'transparent' }}
                  hoverStyle={HOVER_MUTED}
                  onClick={onConfigure}
                >Configurar</Hover>
                <Hover
                  style={{ ...btnGhost(31, 12), background: 'transparent', fontWeight: 400, color: 'var(--mfg)' }}
                  hoverStyle={HOVER_MUTED}
                  onClick={() => setShowLog(v => !v)}
                >Logs</Hover>
              </div>

              {showLog && (
                <div style={{
                  border: '1px solid var(--bd)', borderRadius: 9, overflow: 'hidden',
                  fontFamily: MONO, fontSize: 11.5,
                }}>
                  {log.length === 0 && (
                    <div style={{ padding: '10px 12px', color: 'var(--mfg)' }}>
                      Nenhuma mudança de estado registrada nesta sessão.
                    </div>
                  )}
                  {log.map((e, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, padding: '7px 12px',
                      borderBottom: i === log.length - 1 ? 0 : '1px solid var(--bd)',
                    }}>
                      <span style={{ color: 'var(--mfg)' }}>{clockTime(e.at)}</span>
                      <span>{e.state}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
