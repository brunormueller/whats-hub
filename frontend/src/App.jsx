import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';

/**
 * Três estados possíveis:
 *
 *   sem sessão            → landing / login / cadastro
 *   sessão sem WhatsApp   → onboarding (tela cheia, sem saída para o painel)
 *   sessão completa       → painel
 *
 * O bloqueio não é só visual: o backend recusa /api/messages, /api/ai,
 * /api/leads e /api/metrics com `onboarding_required` enquanto a conta não tem
 * número pareado.
 *
 * O poll da instância (useInstance) NÃO vive aqui: ele é montado por
 * Onboarding e por Dashboard, que só existem com sessão. Manter o hook neste
 * nível exigia um flag de "ligado" e era ele que pintava "Sessão encerrada"
 * por cima do onboarding de uma conta recém-criada.
 */
export default function App() {
  const auth = useAuth();
  const [view, setView] = useState('landing');
  const [theme, setTheme] = useState(() => (localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Volta para a landing ao sair, senão o próximo login cairia na tela antiga
  useEffect(() => {
    if (!auth.session) setView('landing');
  }, [auth.session]);

  if (!auth.session) {
    if (view === 'login') {
      return (
        <Login
          onLogin={auth.login}
          onGoSignup={() => setView('signup')}
          onBack={() => setView('landing')}
        />
      );
    }

    if (view === 'signup') {
      return (
        <Signup
          onSignup={auth.signup}
          onGoLogin={() => setView('login')}
          onBack={() => setView('landing')}
        />
      );
    }

    return <Landing onLogin={() => setView('login')} onSignup={() => setView('signup')} />;
  }

  // Sessão guardada ainda sendo revalidada no /me (401 → useAuth faz logout)
  if (!auth.ready) {
    return (
      <div style={{
        height: '100vh', display: 'grid', placeItems: 'center',
        background: 'var(--bg)', color: 'var(--mfg)', fontSize: 13,
      }}>carregando sua conta…</div>
    );
  }

  if (auth.needsPairing) {
    return (
      <Onboarding
        account={auth.account}
        authFetch={auth.authFetch}
        onConnected={auth.markOnboarded}
        onLogout={auth.logout}
      />
    );
  }

  return (
    <Dashboard
      account={auth.account}
      token={auth.token}
      authFetch={auth.authFetch}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      onLogout={auth.logout}
    />
  );
}
