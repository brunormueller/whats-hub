import { useState } from "react";
import { JAK } from "../ui-dark.jsx";
import AuthShell, {
  AsideEyebrow,
  ErrorBox,
  Field,
  StatRow,
  SubmitButton,
  TextLink,
} from "../components/AuthShell.jsx";
import AnimatedBackground from "../components/AnimatedBackground.tsx";

/* Números do painel de contexto: ilustram o produto, não são dados da conta
   (ninguém está logado ainda para buscá-los). */
const NIGHT = [
  ["Conversas foram atendidas", "", false],
  ["Leads foram qualificados", "", true],
  // ["Escalados para o time", "3", false],
];

function Aside() {
  return (
    <>
      <AsideEyebrow>ENQUANTO VOCÊ DORMIA</AsideEyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {NIGHT.map(([label, value, accent]) => (
          <StatRow key={label} label={label} value={value} accent={accent} />
        ))}
      </div>
      <p
        style={{
          margin: "28px 0 0",
          font: `400 15px/1.6 ${JAK}`,
          color: "#8B9F93",
        }}
      >
        Nenhuma mensagem ficou sem resposta entre 22h e 8h.
      </p>
    </>
  );
}

export default function Login({ onLogin, onGoSignup, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Informe e-mail e senha");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <>
      <AuthShell
        title="Entrar na sua conta"
        subtitle="Retome o painel e as conversas de onde você parou."
        onBack={onBack}
        aside={<Aside />}
        footer={
          <div style={{ display: "flex", gap: "8px" }}>
            <span>Ainda não tem conta?</span>
            <TextLink onClick={onGoSignup}>Criar conta grátis</TextLink>
          </div>
        }
      >
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          onKeyDown={onEnter}
        />

        <Field
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          onKeyDown={onEnter}
        />

        <ErrorBox>{error}</ErrorBox>

        <SubmitButton busy={busy} onClick={submit}>
          {busy ? "Entrando…" : "Entrar"}
        </SubmitButton>
      </AuthShell>
      {/* <AnimatedBackground /> */}
    </>
  );
}
