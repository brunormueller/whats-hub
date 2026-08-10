import { pill, MONO, card, btnPrimary, sectionLabel } from '../ui.jsx';
import { TEAM_DEMO } from '../data/defaults.js';

export default function Team() {
  const { stats, people, queues } = TEAM_DEMO;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px 40px' }}>
      <div style={{ maxWidth: 1080, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
              Equipe e filas
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--mfg)' }}>
              Quem atende o quê, e o que cada pessoa enxerga dentro deste workspace.
            </p>
          </div>
          <button style={btnPrimary(34, 15)}>Convidar pessoa</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {stats.map(s => (
            <div key={s.k} style={{ ...card, borderRadius: 11, padding: '14px 15px' }}>
              <div style={{ fontSize: 12, color: 'var(--mfg)' }}>{s.k}</div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', marginTop: 5 }}>{s.v}</div>
              <div style={{ fontSize: 11.5, color: 'var(--mfg)', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
            borderBottom: '1px solid var(--bd)', ...sectionLabel,
          }}>
            <span style={{ flex: 2 }}>Pessoa</span>
            <span style={{ flex: 1.4 }}>Filas</span>
            <span style={{ width: 150 }}>Permissão</span>
            <span style={{ width: 110 }}>Conversas hoje</span>
            <span style={{ width: 90 }}>Status</span>
          </div>

          {people.map(p => (
            <div key={p.email} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderBottom: '1px solid var(--bd)',
            }}>
              <span style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{
                  width: 32, height: 32, flex: 'none', borderRadius: 999, background: 'var(--muted)',
                  display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--mfg)',
                }}>{p.initials}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--mfg)' }}>{p.email}</span>
                </span>
              </span>
              <span style={{ flex: 1.4, fontSize: 12.5, color: 'var(--mfg)' }}>{p.queues}</span>
              <span style={{ width: 150 }}>
                <span style={pill(p.role === 'Admin' ? 'ok' : p.role === 'Supervisor' ? 'warn' : 'mut')}>
                  {p.role}
                </span>
              </span>
              <span style={{ width: 110, fontSize: 13, fontFamily: MONO }}>{p.today}</span>
              <span style={{
                width: 90, display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 12.5, color: 'var(--mfg)',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: p.on ? 'var(--acc)' : 'var(--bd)',
                }} />
                {p.status}
              </span>
            </div>
          ))}
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--bd)',
            fontSize: 14.5, fontWeight: 600,
          }}>Filas</div>
          {queues.map(q => (
            <div key={q.name} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '13px 16px', borderBottom: '1px solid var(--bd)',
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{q.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--mfg)', marginTop: 2 }}>{q.desc}</span>
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--mfg)' }}>{q.people}</span>
              <span style={pill(q.k)}>{q.ai}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
