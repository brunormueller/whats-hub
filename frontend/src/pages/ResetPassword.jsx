import { useEffect, useState } from 'react';
import { JAK } from '../ui-dark.jsx';
import AuthShell, {
  ErrorBox,
  Field,
  MIN_PASSWORD,
  StrengthBars,
  SubmitButton,
  TextLink,
} from '../components/AuthShell.jsx';
import { RecoveryAside } from './ForgotPassword.jsx';

/**
 * Destino do link do e-mail (/redefinir-senha?token=…).
 *
 * Valida o link assim que abre: com link vencido a pessoa descobre antes de
 * digitar a senha duas vezes. O link só é gasto no envio, e o backend devolve
 * a sessão — quem redefine já entra no painel.
 */
export default function ResetPassword({ token, onVerify, onReset, onRequestNew, onBack }) {
  const [status, setStatus] = useState('checking');   // checking | ready | invalid
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    onVerify(token)
      .then((data) => {
        if (cancelled) return;
        setEmail(data.email);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('invalid');
      });

    return () => { cancelled = true; };
  }, [token, onVerify]);

  async function submit() {
    if (busy) return;
    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa de pelo menos ${MIN_PASSWORD} caracteres`);
      return;
    }
    if (password !== confirm) {
      setError('As duas senhas não são iguais');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await onReset(password);
    } catch (err) {
      setError(err.message);
      // Venceu (ou foi usado em outra aba) enquanto a tela estava aberta
      if (err.code === 'invalid_reset_token') setStatus('invalid');
      setBusy(false);
    }
  }

  const onEnter = (e) => e.key === 'Enter' && submit();

  if (status === 'checking') {
    return (
      <AuthShell title="Validando o link…" subtitle="Só um instante." onBack={onBack} aside={<RecoveryAside />} />
    );
  }

  if (status === 'invalid') {
    return (
      <AuthShell
        title="Link indisponível"
        subtitle="Links de recuperação valem por 30 minutos e funcionam uma vez só."
        onBack={onBack}
        aside={<RecoveryAside />}
      >
        <ErrorBox>{error}</ErrorBox>
        <SubmitButton onClick={onRequestNew}>Pedir um novo link</SubmitButton>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crie uma nova senha"
      subtitle={
        <>
          Para a conta <span style={{ font: `600 15px/1.6 ${JAK}`, color: '#E8EFEA' }}>{email}</span>.
          Depois de salvar, você já entra no painel.
        </>
      }
      onBack={onBack}
      aside={<RecoveryAside />}
      footer={<>Mudou de ideia? <TextLink onClick={onBack}>Deixar como está</TextLink></>}
    >
      {/* Campo oculto com o e-mail: o gerenciador de senhas do navegador
          associa a senha nova à conta certa. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />

      <Field
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`}
        value={password}
        autoFocus
        onChange={(e) => {
          setPassword(e.target.value);
          setError('');
        }}
        onKeyDown={onEnter}
        after={<StrengthBars password={password} />}
      />

      <Field
        label="Confirme a nova senha"
        type="password"
        autoComplete="new-password"
        placeholder="Repita a senha"
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          setError('');
        }}
        onKeyDown={onEnter}
      />

      <ErrorBox>{error}</ErrorBox>

      <SubmitButton busy={busy} onClick={submit}>
        {busy ? 'Salvando…' : 'Salvar nova senha e entrar'}
      </SubmitButton>
    </AuthShell>
  );
}
