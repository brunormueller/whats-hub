import { Hover, HOVER_MUTED, card, btnGhost, pill, MONO } from '../ui.jsx';
import { useInstance } from '../hooks/useInstance.js';
import ConnectPanel from '../components/ConnectPanel.jsx';

/**
 * Gate de onboarding: tela cheia, sem navegação e sem como fechar.
 *
 * Enquanto a conta não tem um número pareado, o backend recusa /api/messages,
 * /api/ai, /api/leads e /api/metrics com `onboarding_required` — então não faz
 * sentido mostrar o painel. Aqui é o único caminho para frente.
 */

const CHECKLIST = [
  ['Conta criada', true, 'Você já está dentro.'],
  ['Conectar o WhatsApp', false, 'Leia o QR code ao lado com o celular que vai atender.'],
  ['Ajustar a IA', false, 'Persona, limites e campos de coleta — libera depois da conexão.'],
];

export default function Onboarding({ account, authFetch, onConnected, onLogout }) {
  // O poll nasce e morre com esta tela: enquanto ela está no ar, existe sessão.
  const instance = useInstance(authFetch, onConnected);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--muted2)', color: 'var(--fg)', fontSize: 14,
    }}>
      <header style={{ borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
        <div className="onb-pad" style={{
          maxWidth: 940, margin: '0 auto', padding: '0 28px', height: 62,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            width: 30, height: 30, borderRadius: 8, background: 'var(--pri)',
            color: 'var(--prifg)', display: 'grid', placeItems: 'center',
            fontWeight: 600, fontSize: 12.5,
          }}>AI</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
              {account?.company || account?.name || 'Sua conta'}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--mfg)' }}>
              {account?.email}
            </span>
          </span>
          <Hover
            onClick={onLogout}
            style={{ ...btnGhost(32, 13), background: 'transparent' }}
            hoverStyle={HOVER_MUTED}
          >Sair</Hover>
        </div>
      </header>

      <main className="onb-pad onb-grid" style={{
        maxWidth: 940, margin: '0 auto', padding: '40px 28px 60px',
        display: 'grid', gridTemplateColumns: '1fr 420px', gap: 22, alignItems: 'start',
      }}>
        <div>
          <span style={pill('warn')}>Falta um passo</span>
          <h1 style={{
            margin: '14px 0 10px', fontSize: 28, fontWeight: 600,
            letterSpacing: '-.02em', textWrap: 'balance',
          }}>
            Conecte seu WhatsApp para liberar o painel
          </h1>
          <p style={{
            margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--mfg)',
            maxWidth: 460, textWrap: 'pretty',
          }}>
            A IA atende pelo seu próprio número. Enquanto ele não estiver pareado,
            não há conversa para mostrar nem métrica para calcular — o resto do
            produto continua bloqueado.
          </p>

          <div style={{ ...card, marginTop: 24, overflow: 'hidden' }}>
            {CHECKLIST.map(([title, done, desc], i) => (
              <div key={title} style={{
                display: 'flex', gap: 12, padding: '14px 18px',
                borderBottom: i < CHECKLIST.length - 1 ? '1px solid var(--bd)' : 0,
              }}>
                <span style={{
                  width: 20, height: 20, flex: 'none', borderRadius: 999,
                  display: 'grid', placeItems: 'center', fontSize: 11,
                  background: done ? 'var(--accsoft)' : 'var(--muted)',
                  color: done ? 'var(--accfg)' : 'var(--mfg)',
                  fontFamily: MONO,
                }}>{done ? '✓' : i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{title}</span>
                  <span style={{
                    display: 'block', fontSize: 12.5, color: 'var(--mfg)',
                    marginTop: 2, textWrap: 'pretty',
                  }}>{desc}</span>
                </span>
              </div>
            ))}
          </div>

          {instance.instanceName && (
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--mfg)' }}>
              Instância desta conta:{' '}
              <span style={{ fontFamily: MONO, color: 'var(--fg)' }}>{instance.instanceName}</span>
            </div>
          )}
        </div>

        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 4 }}>
            Conectar número
          </div>
          <ConnectPanel
            state={instance.state}
            qrcode={instance.qrcode}
            pairingCode={instance.pairingCode}
            error={instance.error}
            qrError={instance.qrError}
            onRefresh={instance.refreshQr}
            onPairingCode={instance.requestPairingCode}
            size={240}
          />
        </div>
      </main>
    </div>
  );
}
