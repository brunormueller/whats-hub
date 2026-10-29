import { Hover } from "../ui.jsx";
import {
  DarkInput,
  HOVER_LINK,
  HOVER_PRI,
  JAK,
  MONO,
  Mark,
  btnPri,
} from "../ui-dark.jsx";

/**
 * Moldura das telas de sessão (login e cadastro) — redesign "Atende IA":
 * tela dividida, formulário de um lado e um painel de contexto do outro.
 *
 * `aside` é o conteúdo do painel; `asideFirst` põe ele à esquerda, como no
 * cadastro do design. Abaixo de 860px o painel sai e sobra só o formulário —
 * o design não tem breakpoint, mas login em celular é o caso mais comum.
 */

const CSS = `
  .auth ::selection{background:#3DDC97;color:#06110B}
  .auth input::placeholder{color:#5F7168}
  @media (max-width:860px){
    .auth-split{grid-template-columns:1fr}
    .auth-aside{display:none}
  }
  @media (max-width:600px){
    .auth,.auth-split{min-height:100vh;min-height:100dvh}
    .auth-panel{justify-content:flex-start;padding:max(28px,env(safe-area-inset-top)) 20px max(32px,env(safe-area-inset-bottom))}
    .auth-panel h2{font-size:26px !important}
  }
`;

const panel = {
  padding: "80px 64px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  onBack,
  aside,
  asideFirst = false,
}) {
  const form = (
    <div
      key="form"
      className="auth-panel"
      style={{ ...panel, background: "#0A0E0C" }}
    >
      <div style={{ maxWidth: 390, width: "100%", margin: "0 auto" }}>
        <Hover
          as="button"
          onClick={onBack}
          title="Voltar para a página inicial"
          hoverStyle={{ opacity: 0.82 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 40,
            border: 0,
            padding: 0,
            background: "transparent",
            cursor: onBack ? "pointer" : "default",
          }}
        >
          <img src="/public/logo.svg" height={60} alt="Logo" />
        </Hover>

        <h2
          style={{
            margin: "0 0 8px",
            font: `700 30px/1.2 ${JAK}`,
            letterSpacing: "-.025em",
            color: "#F3F8F4",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "0 0 30px",
            font: `400 15px/1.6 ${JAK}`,
            color: "#8B9F93",
          }}
        >
          {subtitle}
        </p>

        {children}

        {footer && (
          <p
            style={{
              margin: "22px 0 0",
              font: `400 13.5px/1.5 ${JAK}`,
              color: "#8B9F93",
            }}
          >
            {footer}
          </p>
        )}

        {onBack && (
          <Hover
            onClick={onBack}
            hoverStyle={{ color: "#93A79B" }}
            style={{
              marginTop: 18,
              border: 0,
              padding: 0,
              background: "transparent",
              color: "#5F7168",
              font: `400 12.5px/1 ${JAK}`,
              cursor: "pointer",
            }}
          >
            Voltar para a página inicial
          </Hover>
        )}
      </div>
    </div>
  );

  const side = (
    <div
      key="aside"
      className="auth-aside"
      style={{
        ...panel,
        position: "relative",
        background: "linear-gradient(150deg,#0F1613,#0A0E0C)",
        [asideFirst ? "borderRight" : "borderLeft"]:
          "1px solid rgba(255,255,255,.07)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: asideFirst ? "auto auto -25% -20%" : "-30% -30% auto auto",
          width: 520,
          height: 520,
          background:
            "radial-gradient(circle,rgba(61,220,151,.14),transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", maxWidth: 430 }}>{aside}</div>
      <img
        src="/public/Sheep.svg"
        style={{ position: "absolute", top: "-8rem" }}
        height={390}
        alt="Logo"
      />
    </div>
  );

  return (
    <div
      className="auth"
      style={{
        minHeight: "100vh",
        background: "#0A0E0C",
        color: "#E8EFEA",
        fontFamily: JAK,
      }}
    >
      <style>{CSS}</style>
      <div
        className="auth-split"
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {asideFirst ? [side, form] : [form, side]}
      </div>
    </div>
  );
}

/** Campo de formulário com rótulo, no estilo escuro. `after` entra logo
    abaixo do input (a barra de força da senha, por exemplo). */
export function Field({ label, hint, after, ...input }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span
        style={{
          display: "block",
          marginBottom: 7,
          font: `600 12.5px/1 ${JAK}`,
          color: "#A9BCB0",
        }}
      >
        {label}
      </span>
      <DarkInput {...input} />
      {after}
      {hint && (
        <span
          style={{
            display: "block",
            marginTop: 7,
            font: `400 11.5px/1.4 ${JAK}`,
            color: "#6F8478",
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

// Mesmo mínimo do backend (services/accounts.js)
export const MIN_PASSWORD = 8;

/** Três barras de força, como no design. 0 a 3. */
function strength(password) {
  if (password.length < MIN_PASSWORD) return password ? 1 : 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^\w]/].filter((r) => r.test(password)).length;
  return variety >= 3 && password.length >= 12 ? 3 : 2;
}

export function StrengthBars({ password }) {
  const score = strength(password);
  return (
    <span style={{ display: "flex", gap: 5, marginTop: 9 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i < score ? "#3DDC97" : "rgba(255,255,255,.1)",
            transition: "background .2s",
          }}
        />
      ))}
    </span>
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div
      style={{
        marginBottom: 16,
        padding: "11px 13px",
        borderRadius: 11,
        border: "1px solid rgba(248,113,113,.28)",
        background: "rgba(248,113,113,.1)",
        font: `400 12.5px/1.5 ${JAK}`,
        color: "#FCA5A5",
      }}
    >
      {children}
    </div>
  );
}

/** Botão de envio das telas de sessão. */
export function SubmitButton({ busy, children, ...rest }) {
  return (
    <Hover
      type="button"
      hoverStyle={busy ? null : HOVER_PRI}
      style={{
        ...btnPri("14px", 15, "0 14px 34px -16px rgba(61,220,151,.9)"),
        width: "100%",
        borderRadius: 11,
        opacity: busy ? 0.6 : 1,
        cursor: busy ? "default" : "pointer",
        whiteSpace: "normal",
      }}
      disabled={busy}
      {...rest}
    >
      {children}
    </Hover>
  );
}

/** Link de texto usado nos rodapés das telas de sessão. */
export function TextLink({ onClick, children }) {
  return (
    <Hover
      onClick={onClick}
      hoverStyle={HOVER_LINK}
      style={{
        border: 0,
        padding: 0,
        background: "transparent",
        color: "#8CE7BC",
        font: `500 13.5px/1 ${JAK}`,
        cursor: "pointer",
      }}
    >
      {children}
    </Hover>
  );
}

/* ---- peças do painel de contexto ---- */

export function AsideEyebrow({ children }) {
  return (
    <div
      style={{
        font: `500 11.5px/1 ${MONO}`,
        color: "#3DDC97",
        letterSpacing: ".14em",
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}

export function AsideTitle({ children }) {
  return (
    <h2
      style={{
        margin: "0 0 28px",
        font: `700 32px/1.2 ${JAK}`,
        letterSpacing: "-.025em",
        color: "#F3F8F4",
      }}
    >
      {children}
    </h2>
  );
}

export function StatRow({ label, value, accent }) {
  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
      }}
    >
      <span style={{ font: `400 14px/1.4 ${JAK}`, color: "#B9C7BF" }}>
        {label}
      </span>
      <span
        style={{
          font: `800 22px/1 ${JAK}`,
          color: accent ? "#3DDC97" : "#F3F8F4",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function StepRow({ n, title, desc }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span
        style={{
          flex: "none",
          width: 28,
          height: 28,
          borderRadius: 9,
          background: "rgba(61,220,151,.12)",
          border: "1px solid rgba(61,220,151,.22)",
          display: "grid",
          placeItems: "center",
          font: `500 12px/1 ${MONO}`,
          color: "#8CE7BC",
        }}
      >
        {n}
      </span>
      <div>
        <div style={{ font: `600 15px/1.4 ${JAK}`, color: "#E8EFEA" }}>
          {title}
        </div>
        <div style={{ font: `400 13.5px/1.6 ${JAK}`, color: "#8B9F93" }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

export function NoteBox({ children }) {
  return (
    <div
      style={{
        marginTop: 34,
        padding: "18px 20px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        font: `400 13.5px/1.6 ${JAK}`,
        color: "#8B9F93",
      }}
    >
      {children}
    </div>
  );
}
