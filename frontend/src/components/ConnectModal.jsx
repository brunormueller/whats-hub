import { Hover, HOVER_MUTED, btnPrimary, btnGhost } from '../ui.jsx';
import ConnectPanel from './ConnectPanel.jsx';

/**
 * Modal de (re)conexão do número — usado pela tela de Canais.
 * O onboarding obrigatório não usa modal: é a tela cheia em pages/Onboarding.
 */
export default function ConnectModal({
  state, qrcode, pairingCode, error, qrError, onRefresh, onPairingCode, onClose,
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(9,9,11,.55)',
        display: 'grid', placeItems: 'center', zIndex: 50, padding: 12,
      }}
      onClick={(e) => { if (onClose && e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 440, maxWidth: '100%', maxHeight: '100%', overflow: 'auto',
        background: 'var(--card)', border: '1px solid var(--bd)',
        borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.35)', padding: 22,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 4 }}>
          Conectar número
        </div>

        <ConnectPanel
          state={state}
          qrcode={qrcode}
          pairingCode={pairingCode}
          error={error}
          qrError={qrError}
          onRefresh={onRefresh}
          onPairingCode={onPairingCode}
        />

        {onClose && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Hover
              style={{ ...btnGhost(34, 14), background: 'transparent' }}
              hoverStyle={HOVER_MUTED}
              onClick={onClose}
            >Fechar</Hover>
            <button style={btnPrimary(34, 14)} onClick={onClose}>Já conectei</button>
          </div>
        )}
      </div>
    </div>
  );
}
