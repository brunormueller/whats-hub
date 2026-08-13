import { Hover, HOVER_MUTED, Switch } from "../ui.jsx";

const NAV_MAIN = [
  { k: "dashboard", label: "Painel", icon: "◨" },
  // { k: "inbox", label: "Caixa de entrada", icon: "▤" },
  // { k: "team", label: "Equipe e filas", icon: "☰" },
];

const NAV_CFG = [
  { k: "channels", label: "Canais", icon: "◎" },
  { k: "ai", label: "Comportamento da IA", icon: "✦" },
];

function navStyle(on) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "7px 9px",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: on ? 500 : 400,
    background: on ? "var(--card)" : "transparent",
    boxShadow: on ? "var(--shadow)" : "none",
    border: `1px solid ${on ? "var(--bd)" : "transparent"}`,
    color: "var(--fg)",
  };
}

const groupLabel = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--mfg)",
};

const footerBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "7px 9px",
  border: "1px solid var(--bd)",
  background: "var(--card)",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12.5,
  color: "var(--mfg)",
};

function NavItem({ item, screen, onScreen, badge }) {
  const on = screen === item.k;
  return (
    <Hover
      style={navStyle(on)}
      hoverStyle={on ? undefined : HOVER_MUTED}
      onClick={() => onScreen(item.k)}
    >
      <span
        style={{
          width: 16,
          display: "grid",
          placeItems: "center",
          color: "var(--mfg)",
        }}
      >
        {item.icon}
      </span>
      <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
      {!!badge && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            background: "var(--muted)",
            color: "var(--mfg)",
            borderRadius: 999,
            padding: "1px 7px",
          }}
        >
          {badge}
        </span>
      )}
    </Hover>
  );
}

/** Iniciais do workspace: primeira letra das duas primeiras palavras. */
function initialsOf(text) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "··";
  return (words[0][0] + (words[1]?.[0] || "")).toUpperCase();
}

export default function Sidebar({
  screen,
  onScreen,
  account,
  theme,
  onToggleTheme,
  unread,
  onLogout,
  aiEnabled,
  onToggleAi,
}) {
  const workspace = account?.company || account?.name || "Sua conta";

  return (
    <aside
      style={{
        width: 248,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        background: "var(--side)",
        borderRight: "1px solid var(--bd)",
      }}
    >
      <div
        style={{
          padding: "12px 12px 10px",
          borderBottom: "1px solid var(--bd)",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: 8,
            border: "1px solid var(--bd)",
            background: "var(--card)",
            borderRadius: 8,
            textAlign: "left",
            boxShadow: "var(--shadow)",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              flex: "none",
              borderRadius: 7,
              background: "var(--pri)",
              color: "var(--prifg)",
              display: "grid",
              placeItems: "center",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {initialsOf(workspace)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontWeight: 500,
                fontSize: 13,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {workspace}
            </span>
            <span
              style={{
                display: "block",
                fontSize: 11.5,
                color: "var(--mfg)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {account?.email}
            </span>
          </span>
        </div>
      </div>

      {/* navegação */}
      <nav
        style={{
          flex: 1,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflow: "auto",
        }}
      >
        {/* <div style={{ ...groupLabel, padding: "6px 8px 6px" }}>Atendimento</div> */}
        {NAV_MAIN.map((item) => (
          <NavItem
            key={item.k}
            item={item}
            screen={screen}
            onScreen={onScreen}
            badge={item.k === "inbox" ? unread : 0}
          />
        ))}

        <div style={{ ...groupLabel, padding: "16px 8px 6px" }}>
          Configuração
        </div>
        {NAV_CFG.map((item) => (
          <NavItem
            key={item.k}
            item={item}
            screen={screen}
            onScreen={onScreen}
          />
        ))}
      </nav>

      <div
        style={{
          padding: 10,
          borderTop: "1px solid var(--bd)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Desligar a resposta automática precisa funcionar de QUALQUER tela e
            sem depender de ter conversa aberta — se a IA começa a responder
            errado, procurar onde clicar não é opção. Por isso mora aqui e não
            dentro do inbox. */}
        <div
          style={{
            ...footerBtn,
            cursor: "default",
            borderColor: aiEnabled ? "var(--bd)" : "var(--pri)",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ color: "var(--fg)", fontWeight: 500 }}>
              Resposta automática
            </span>
            <span style={{ fontSize: 11 }}>
              {aiEnabled ? "IA atendendo" : "desligada — ninguém responde"}
            </span>
          </span>
          <Switch
            on={aiEnabled}
            onChange={onToggleAi}
            title={aiEnabled ? "Desligar a IA" : "Ligar a IA"}
          />
        </div>

        <Hover
          onClick={onToggleTheme}
          style={footerBtn}
          hoverStyle={HOVER_MUTED}
        >
          <span>Tema</span>
          <span style={{ fontWeight: 500, color: "var(--fg)" }}>
            {theme === "light" ? "Claro" : "Escuro"}
          </span>
        </Hover>

        <Hover onClick={onLogout} style={footerBtn} hoverStyle={HOVER_MUTED}>
          <span>Sessão</span>
          <span style={{ fontWeight: 500, color: "var(--fg)" }}>Sair</span>
        </Hover>
      </div>
    </aside>
  );
}
