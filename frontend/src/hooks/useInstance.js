import { useState, useEffect, useCallback, useRef } from 'react';

const STATE_POLL_MS = 3000;   // checa a conexão
const QR_REFRESH_MS = 30000;  // o QR da Evolution expira em ~40s

/**
 * Acompanha a instância da Evolution API da conta logada e mantém um QR code
 * válido enquanto o número não estiver pareado.
 *
 * **Só monte este hook dentro de uma tela que exige sessão** (Onboarding ou
 * Dashboard). Ele não tem interruptor de "ligado/desligado": sem sessão, o
 * certo é o hook não existir.
 *
 * Recebe o `authFetch` da sessão (não o token cru): assim um 401 no poll
 * derruba o login em vez de deixar a tela girando com erro de autorização.
 *
 * O cancelamento é por execução de efeito (`let stopped`), NÃO por um ref
 * `alive` compartilhado. Em StrictMode o React monta, desmonta e remonta: um
 * ref zerado na limpeza da primeira passada nunca voltava a true, e daí todo
 * setState era descartado em silêncio — as requisições respondiam certo e a
 * tela ficava eternamente em "verificando a conexão…" / "gerando qr code…".
 *
 * Retorna:
 *   state       'loading' | 'open' | 'connecting' | 'close' | 'not_found'
 *               | 'error' | 'disabled' (provider meta)
 *   connected   true quando state === 'open'
 *   qrcode      data URI da imagem do QR (null quando conectado)
 *   pairingCode código de 8 dígitos, quando solicitado via requestPairingCode()
 *   error       falha de comunicação com o backend/Evolution
 *   qrError     motivo de não haver QR na tela, quando a chamada respondeu
 */
export function useInstance(authFetch, onConnected) {
  const [state, setState] = useState('loading');
  const [instanceName, setInstanceName] = useState(null);
  const [qrcode, setQrcode] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [error, setError] = useState(null);
  // Motivo separado do erro geral: o QR pode faltar com a conexão saudável
  const [qrError, setQrError] = useState(null);

  // Evita duas requisições de QR sobrepostas. Ref é seguro aqui porque se
  // reseta sozinho no `finally` da própria chamada.
  const fetchingQr = useRef(false);

  // O callback muda de identidade a cada render do pai; guardar em ref evita
  // reiniciar o poll por causa disso.
  const connectedRef = useRef(onConnected);
  connectedRef.current = onConnected;

  const api = useCallback(async (path) => {
    const res = await authFetch(`/api/instance${path}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(payload.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return payload;
  }, [authFetch]);

  const refreshQr = useCallback(async (number) => {
    if (fetchingQr.current) return;
    fetchingQr.current = true;
    setQrError(null);
    try {
      const query = number ? `?number=${encodeURIComponent(number)}` : '';
      const data = await api(`/qr${query}`);

      setQrcode(data.qrcode || null);
      setPairingCode(data.pairingCode || null);
      setError(null);

      // A Evolution respondeu, mas sem imagem nem código de pareamento. Sem
      // dizer isso na tela, o painel ficava em "gerando qr code…" para sempre.
      if (!data.qrcode && !data.pairingCode && !data.connected) {
        setQrError(data.code
          ? 'A Evolution devolveu o QR em texto, sem imagem. Use o código de telefone.'
          : 'A Evolution não devolveu QR nem código. Tente gerar de novo.');
      }
    } catch (err) {
      setError(err.message);
      setQrError(err.message);
    } finally {
      fetchingQr.current = false;
    }
  }, [api]);

  // Poll do estado da conexão
  useEffect(() => {
    let stopped = false;
    let timer;

    async function check() {
      try {
        const data = await api('');
        if (stopped) return;

        setState(data.state);
        setInstanceName(data.instance || null);
        setError(null);

        if (data.state === 'open') {
          setQrcode(null);
          setPairingCode(null);
          setQrError(null);
          // O backend marca `onboardedAt` nesta mesma chamada — avisa o App
          // para sair da tela de conexão.
          if (data.onboarded) connectedRef.current?.();
        }
      } catch (err) {
        if (stopped) return;

        // 404 = rota não montada (provider 'meta'): não há o que parear,
        // então o gate de conexão fica desligado e o poll para.
        if (err.status === 404) {
          setState('disabled');
          return;
        }

        setState('error');
        setError(err.message);
      }

      if (!stopped) timer = setTimeout(check, STATE_POLL_MS);
    }

    check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [api]);

  // Busca e renova o QR enquanto não estiver conectado.
  // 'error' entra na lista de propósito: falha passageira de comunicação não
  // pode deixar a tela parada sem nunca tentar de novo.
  useEffect(() => {
    const needsQr = state === 'close' || state === 'connecting'
      || state === 'not_found' || state === 'error';
    if (!needsQr) return undefined;

    refreshQr();
    const timer = setInterval(refreshQr, QR_REFRESH_MS);
    return () => clearInterval(timer);
  }, [state, refreshQr]);

  const disconnect = useCallback(async () => {
    try {
      await authFetch('/api/instance', { method: 'DELETE' });
      setState('close');
      setQrcode(null);
    } catch (err) {
      setError(err.message);
    }
  }, [authFetch]);

  return {
    state,
    instanceName,
    connected: state === 'open',
    // 'loading' e 'disabled' não devem exibir o modal de pareamento
    needsPairing: !['open', 'loading', 'disabled'].includes(state),
    qrcode,
    pairingCode,
    error,
    qrError,
    refreshQr,
    requestPairingCode: (number) => refreshQr(number),
    disconnect,
  };
}
