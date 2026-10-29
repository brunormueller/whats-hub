import { useState } from 'react';
import { JAK } from '../ui-dark.jsx';
import AuthShell, {
  AsideEyebrow,
  AsideTitle,
  ErrorBox,
  Field,
  MIN_PASSWORD,
  NoteBox,
  StepRow,
  StrengthBars,
  SubmitButton,
  TextLink,
} from '../components/AuthShell.jsx';

const AFTER_SIGNUP = [
  ['Leia o QR code', 'Seu número conecta sem migrar de conta.'],
  ['Escolha a persona', 'Tom de voz, limites e os campos a coletar.'],
  ['Teste com você mesmo', 'Mande uma mensagem e veja a IA responder.'],
];

function Aside() {
  return (
    <>
      <AsideEyebrow>TRÊS MINUTOS ATÉ A PRIMEIRA RESPOSTA</AsideEyebrow>
      <AsideTitle>O que acontece depois do cadastro</AsideTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {AFTER_SIGNUP.map(([title, desc], i) => (
          <StepRow key={title} n={i + 1} title={title} desc={desc} />
        ))}
      </div>
      <NoteBox>
        O cadastro é grátis e sem cartão. O primeiro passo depois de entrar é
        conectar o seu WhatsApp por QR code.
      </NoteBox>
    </>
  );
}

export default function Signup({ onSignup, onGoLogin, onBack }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', password: '' });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setError('');
  };

  async function submit() {
    if (busy) return;

    if (!form.name.trim()) return setError('Informe seu nome');
    if (!form.email.trim()) return setError('Informe seu e-mail');
    if (form.password.length < MIN_PASSWORD) {
      return setError(`A senha precisa de pelo menos ${MIN_PASSWORD} caracteres`);
    }
    if (!accepted) return setError('É preciso aceitar os termos para continuar');

    setBusy(true);
    setError('');

    try {
      await onSignup({
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        password: form.password,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const onEnter = (e) => e.key === 'Enter' && submit();

  return (
    <AuthShell
      title="Criar conta grátis"
      subtitle="Sem cartão de crédito. Cancele quando quiser."
      onBack={onBack}
      aside={<Aside />}
      asideFirst
      footer={<>Já tem conta? <TextLink onClick={onGoLogin}>Entrar</TextLink></>}
    >
      <Field
        label="Nome completo"
        autoComplete="name"
        placeholder="Marina Duarte"
        value={form.name}
        onChange={set('name')}
        onKeyDown={onEnter}
      />

      <Field
        label="Empresa"
        hint="Opcional — aparece no topo do painel"
        autoComplete="organization"
        placeholder="Clínica Sorriso"
        value={form.company}
        onChange={set('company')}
        onKeyDown={onEnter}
      />

      <Field
        label="E-mail corporativo"
        type="email"
        autoComplete="email"
        placeholder="voce@empresa.com.br"
        value={form.email}
        onChange={set('email')}
        onKeyDown={onEnter}
      />

      <Field
        label="Senha"
        type="password"
        autoComplete="new-password"
        placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`}
        value={form.password}
        onChange={set('password')}
        onKeyDown={onEnter}
        after={<StrengthBars password={form.password} />}
      />

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 9,
          margin: '4px 0 22px',
          font: `400 12.5px/1.55 ${JAK}`,
          color: '#8B9F93',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => { setAccepted(e.target.checked); setError(''); }}
          style={{ marginTop: 2, width: 15, height: 15, accentColor: '#3DDC97' }}
        />
        <span>
          Li e aceito os Termos de uso e a Política de Privacidade, incluindo o
          tratamento de dados conforme a LGPD.
        </span>
      </label>

      <ErrorBox>{error}</ErrorBox>

      <SubmitButton busy={busy} onClick={submit}>
        {busy ? 'Criando…' : 'Criar conta e conectar WhatsApp'}
      </SubmitButton>
    </AuthShell>
  );
}
