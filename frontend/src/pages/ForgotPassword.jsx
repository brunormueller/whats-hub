import { useEffect, useState } from 'react';
import { JAK } from '../ui-dark.jsx';
import AuthShell, {
  AsideEyebrow,
  AsideTitle,
  ErrorBox,
  Field,
  NoteBox,
  StepRow,
  SubmitButton,
  TextLink,
} from '../components/AuthShell.jsx';

// O backend ignora um segundo pedido da mesma conta dentro de 1 minuto
// (services/passwordReset.js); o botão de reenviar espera o mesmo tempo.
const RESEND_SECONDS = 60;

const STEPS = [
  ['Informe seu e-mail', 'O mesmo que você usa para entrar no painel.'],
  ['Abra o link que enviamos', 'Ele vale por 30 minutos e funciona uma vez só.'],
  ['Crie uma senha nova', 'E entre direto no painel, sem refazer o login.'],
];

/** Painel de contexto das telas de recuperação (esta e a de nova senha). */
export function RecoveryAside() {
  return (
    <>
      <AsideEyebrow>RECUPERAÇÃO DE ACESSO</AsideEyebrow>
      <AsideTitle>Três passos e você está de volta</AsideTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {STEPS.map(([title, desc], i) => (
          <StepRow key={title} n={i + 1} title={title} desc={desc} />
        ))}
      </div>
      <NoteBox>
        Por segurança, trocar a senha encerra as sessões abertas em outros
        aparelhos. A IA continua atendendo normalmente enquanto isso.
      </NoteBox>
    </>
  );
}

function SentBox({ email, minutes }) {
  return (
    <div
      style={{
        marginBottom: 22,
        padding: '16px 18px',
        borderRadius: 14,
        border: '1px solid rgba(61,220,151,.28)',
        background: 'rgba(61,220,151,.08)',
        font: `400 13.5px/1.6 ${JAK}`,
        color: '#B9C7BF',
      }}
    >
      <div style={{ font: `600 14px/1.4 ${JAK}`, color: '#8CE7BC', marginBottom: 4 }}>
        Link enviado para {email}
      </div>
      Ele vale por {minutes} minutos. Não chegou em alguns instantes? Confira as
      pastas de spam e promoções.
    </div>
  );
}

export default function ForgotPassword({ initialEmail = '', onRequest, onGoLogin, onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);   // { email, minutes }
  const [wait, setWait] = useState(0);      // segundos até poder reenviar

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function submit() {
    if (busy) return;
    if (!email.trim()) {
      setError('Informe seu e-mail');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const data = await onRequest(email.trim());
      setSent({ email: email.trim(), minutes: data.minutes || 30 });
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const onEnter = (e) => e.key === 'Enter' && submit();

  if (sent) {
    return (
      <AuthShell
        title="Confira seu e-mail"
        subtitle="Se existir uma conta com esse endereço, o link para criar uma nova senha já está a caminho."
        onBack={onBack}
        aside={<RecoveryAside />}
        footer={
          wait > 0 ? (
            <>Reenviar disponível em {wait}s</>
          ) : (
            <>Não recebeu? <TextLink onClick={submit}>{busy ? 'Reenviando…' : 'Reenviar link'}</TextLink></>
          )
        }
      >
        <SentBox email={sent.email} minutes={sent.minutes} />
        <ErrorBox>{error}</ErrorBox>
        <SubmitButton onClick={onGoLogin}>Voltar para o login</SubmitButton>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Esqueceu a senha?"
      subtitle="Informe o e-mail da sua conta e enviamos um link para você criar uma nova."
      onBack={onBack}
      aside={<RecoveryAside />}
      footer={<>Lembrou? <TextLink onClick={onGoLogin}>Voltar para o login</TextLink></>}
    >
      <Field
        label="E-mail"
        type="email"
        autoComplete="email"
        placeholder="voce@empresa.com.br"
        value={email}
        autoFocus
        onChange={(e) => {
          setEmail(e.target.value);
          setError('');
        }}
        onKeyDown={onEnter}
      />

      <ErrorBox>{error}</ErrorBox>

      <SubmitButton busy={busy} onClick={submit}>
        {busy ? 'Enviando…' : 'Enviar link de recuperação'}
      </SubmitButton>
    </AuthShell>
  );
}
