import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';

// Destino do link do e-mail de recuperação (backend: services/passwordReset.js)
const RESET_PATH = '/redefinir-senha';

function readResetToken() {
  if (window.location.pathname !== RESET_PATH) return null;
  return new URLSearchParams(window.location.search).get('token') || null;
}

/**
 * Três estados possíveis:
 *
 *   sem sessão            → landing / login / cadastro
 *   sessão sem WhatsApp   → onboarding (tela cheia, sem saída para o painel)
 *   sessão completa       → painel
 *
 * Por cima dos três, o link de recuperação de senha: aberto de dentro do
 * e-mail, vale com ou sem sessão, e ao salvar a senha nova já entra na conta.
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
  const [resetToken, setResetToken] = useState(readResetToken);
  // E-mail digitado no login, para a tela de recuperação já abrir preenchida
  const [forgotEmail, setForgotEmail] = useState('');
  const [theme, setTheme] = useState(() => (localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Tira o token da barra de endereço (e do histórico) assim que ele é lido:
  // quem pegar o navegador depois não reaproveita o link.
  useEffect(() => {
    if (window.location.pathname === RESET_PATH) window.history.replaceState(null, '', '/');
  }, []);

  // Volta para a landing ao sair, senão o próximo login cairia na tela antiga
  useEffect(() => {
    if (!auth.session) setView('landing');
  }, [auth.session]);

  if (resetToken) {
    const leave = (next) => {
      setResetToken(null);
      setView(next);
    };

    return (
      <ResetPassword
        token={resetToken}
        onVerify={auth.verifyResetToken}
        onReset={async (password) => {
          await auth.resetPassword(resetToken, password);
          setResetToken(null);
        }}
        onRequestNew={() => leave('forgot')}
        onBack={() => leave('landing')}
      />
    );
  }

  if (!auth.session) {
    if (view === 'login') {
      return (
        <Login
          onLogin={auth.login}
          onGoSignup={() => setView('signup')}
          onForgot={(email) => {
            setForgotEmail(email);
            setView('forgot');
          }}
          onBack={() => setView('landing')}
        />
      );
    }

    if (view === 'forgot') {
      return (
        <ForgotPassword
          initialEmail={forgotEmail}
          onRequest={auth.requestPasswordReset}
          onGoLogin={() => setView('login')}
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
