import { useState } from 'react';
import { Hover, HOVER_MUTED, pill, MONO, btnPrimary, btnGhost, inputStyle } from '../ui.jsx';

/**
 * Miolo do pareamento do número: QR code, código de telefone, estado da
 * conexão e erros.
 *
 * Usado em dois lugares — no modal de reconexão (tela de Canais) e na tela de
 * onboarding, que é bloqueante. Por isso o componente não desenha moldura nem
 * botão de fechar: quem monta decide isso.
 */

const STATE_PILL = {
  loading: ['Verificando conexão…', 'mut'],
  not_found: ['Instância não criada', 'warn'],
  close: ['Desconectado', 'bad'],
  connecting: ['Aguardando leitura do QR…', 'warn'],
  open: ['Número conectado', 'ok'],
  error: ['Erro de comunicação', 'bad'],
  disabled: ['Cloud API — nada a parear', 'ok'],
};

/**
 * O que está no lugar do QR quando não há imagem. Antes dizia sempre "gerando
 * qr code…", inclusive com a instância conectada ou o backend fora do ar — a
 * tela ficava girando sem nunca sair disso.
 */
function placeholder(state, qrError) {
  if (state === 'open') return 'número já conectado';
  if (state === 'disabled') return 'provider meta: sem pareamento';
  if (qrError) return 'sem qr code — veja o motivo abaixo';
  if (state === 'loading') return 'verificando a conexão…';
  return 'gerando qr code…';
}

const checker = {
  background: 'repeating-linear-gradient(45deg,var(--muted),var(--muted) 8px,var(--muted2) 8px,var(--muted2) 16px)',
};

export default function ConnectPanel({
  state, qrcode, pairingCode, error, qrError, onRefresh, onPairingCode, size = 220,
}) {
  const [byPhone, setByPhone] = useState(false);
  const [number, setNumber] = useState('');

  const [label, kind] = STATE_PILL[state] || ['Conectando…', 'mut'];

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--mfg)', textWrap: 'pretty' }}>
        {byPhone
          ? 'Informe o número com DDI e DDD para receber um código de pareamento de 8 dígitos.'
          : 'Abra o WhatsApp no celular, vá em Aparelhos conectados e leia o código.'}
      </div>

      {byPhone ? (
        <div style={{ margin: '18px 0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1, fontFamily: MONO }}
              placeholder="5511999990000"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onPairingCode(number)}
            />
            <button style={btnPrimary(36, 14)} onClick={() => onPairingCode(number)}>
              Gerar código
            </button>
          </div>
          {pairingCode && (
            <div style={{
              marginTop: 16, border: '1px solid var(--bd)', borderRadius: 10,
              padding: '18px 12px', textAlign: 'center', background: 'var(--muted2)',
            }}>
              <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, letterSpacing: 4 }}>
                {pairingCode}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--mfg)', marginTop: 8, textWrap: 'pretty' }}>
                No celular: Aparelhos conectados → Conectar aparelho → Conectar com número de telefone
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{
            margin: '18px 0', height: size, border: '1px solid var(--bd)',
            borderRadius: 10, display: 'grid', placeItems: 'center',
            ...(qrcode ? { background: '#fff' } : checker),
          }}>
            {qrcode ? (
              <img
                src={qrcode}
                alt="QR code do WhatsApp"
                style={{ height: size - 20, width: size - 20, imageRendering: 'pixelated' }}
              />
            ) : (
              <span style={{
                fontFamily: MONO, fontSize: 11.5, color: 'var(--mfg)',
                background: 'var(--card)', border: '1px solid var(--bd)',
                borderRadius: 6, padding: '5px 10px', textAlign: 'center',
              }}>{placeholder(state, qrError)}</span>
            )}
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--mfg)', lineHeight: 1.7 }}>
            1. Abra o WhatsApp no celular<br />
            2. Toque em <b style={{ color: 'var(--fg)', fontWeight: 500 }}>Aparelhos conectados</b><br />
            3. Toque em <b style={{ color: 'var(--fg)', fontWeight: 500 }}>Conectar aparelho</b><br />
            4. Aponte a câmera para o código acima
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <span style={pill(kind)}>
          <span style={{
            width: 6, height: 6, borderRadius: 999, background: 'currentColor',
            animation: 'dcpulse 2s ease-in-out infinite',
          }} />
          {label}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => { setByPhone((v) => !v); onRefresh(); }}
          style={{
            border: 0, background: 'transparent', color: 'var(--mfg)',
            fontSize: 12.5, cursor: 'pointer', padding: 0,
          }}
        >{byPhone ? '← Voltar para o QR code' : 'Usar código de telefone'}</button>
      </div>

      {(error || qrError) && (
        <div style={{
          marginTop: 12, background: 'var(--dangersoft)', color: 'var(--danger)',
          fontSize: 12, padding: '10px 12px', borderRadius: 8, lineHeight: 1.5,
        }}>{error || qrError}</div>
      )}

      <Hover
        style={{ ...btnGhost(34, 14), background: 'transparent', marginTop: 14, width: '100%' }}
        hoverStyle={HOVER_MUTED}
        onClick={() => onRefresh()}
      >Gerar novo código</Hover>
    </>
  );
}
