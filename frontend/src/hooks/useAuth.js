import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Sessão do produto: cadastro, login e o estado de onboarding.
 *
 * O token é um JWT do backend guardado em localStorage. `onboarded` diz se a
 * conta já conectou um WhatsApp — é o que o App usa para decidir entre a tela
 * de conexão e o painel.
 */

const STORAGE_KEY = 'hub_session';

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function useAuth() {
  const [session, setSession] = useState(readStored);
  // `ready` evita piscar a landing enquanto o /me da sessão salva não volta
  const [ready, setReady] = useState(() => !readStored());

  const persist = useCallback((next) => {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    persist(null);
    setReady(true);
  }, [persist]);

  /** Revalida o token guardado — cobre senha trocada, conta apagada, exp. */
  useEffect(() => {
    const stored = readStored();
    if (!stored) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${stored.token}` },
        });
        if (cancelled) return;

        if (res.status === 401) {
          persist(null);
          return;
        }

        const data = await res.json();
        persist({
          ...stored,
          account: data.account,
          onboarded: data.onboarded,
          needsPairing: data.needsPairing,
        });
      } catch {
        // Backend fora do ar: mantém a sessão local e deixa as telas mostrarem
        // o erro delas em vez de derrubar o login.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [persist]);

  const enter = useCallback((data) => {
    persist({
      token: data.token,
      account: data.account,
      onboarded: data.onboarded,
      needsPairing: data.needsPairing,
    });
    setReady(true);
  }, [persist]);

  const login = useCallback(async (email, password) => {
    enter(await post('/api/auth/login', { email, password }));
  }, [enter]);

  const signup = useCallback(async (payload) => {
    enter(await post('/api/auth/signup', payload));
  }, [enter]);

  /** Chamado quando o número pareia: libera o resto do produto. */
  const markOnboarded = useCallback(() => {
    setSession((prev) => {
      if (!prev || (prev.onboarded && !prev.needsPairing)) return prev;
      const next = { ...prev, onboarded: true, needsPairing: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /**
   * fetch com o token da sessão. 401 derruba o login; 403 de onboarding volta
   * o usuário para a tela de conexão em vez de mostrar erro solto na tela.
   */
  const authFetch = useCallback(async (path, options = {}) => {
    const token = session?.token;

    const res = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.status === 401) {
      logout();
      throw new Error('Sessão expirada');
    }

    if (res.status === 403) {
      const data = await res.clone().json().catch(() => ({}));
      if (data.code === 'onboarding_required') {
        setSession((prev) => {
          if (!prev) return prev;
          const next = { ...prev, onboarded: false, needsPairing: true };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
    }

    return res;
  }, [session?.token, logout]);

  return useMemo(() => ({
    session,
    account: session?.account || null,
    token: session?.token || '',
    onboarded: Boolean(session?.onboarded),
    // O gate liga por needsPairing, não por onboarded: no provider `meta` não
    // existe pareamento e o painel abre direto.
    needsPairing: Boolean(session?.needsPairing),
    ready,
    login,
    signup,
    logout,
    markOnboarded,
    authFetch,
  }), [session, ready, login, signup, logout, markOnboarded, authFetch]);
}
