import { Hover } from "../ui.jsx";
import {
  HOVER_CARD,
  HOVER_GHOST,
  HOVER_PRI,
  JAK,
  MONO,
  Mark,
  btnGhost,
  btnPri,
} from "../ui-dark.jsx";

/**
 * Página pública do produto — redesign "Atende IA".
 *
 * Único caminho de entrada para quem não tem sessão: daqui sai para cadastro
 * ou login. Tokens visuais em ui-dark.jsx, compartilhados com as telas de
 * sessão — cores literais porque o design não prevê variação claro/escuro.
 */

const shell = { maxWidth: 1200, margin: "0 auto" };

const eyebrow = {
  font: `500 11.5px/1 ${MONO}`,
  color: "#3DDC97",
  letterSpacing: ".14em",
  marginBottom: 14,
};

const heading = {
  margin: 0,
  font: `700 38px/1.14 ${JAK}`,
  letterSpacing: "-.028em",
  color: "#F3F8F4",
};

const cardBase = {
  padding: 26,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.08)",
  background: "linear-gradient(180deg,#111714,#0D1210)",
};

const cardTitle = {
  margin: "0 0 9px",
  font: `700 17px/1.3 ${JAK}`,
  color: "#EFF5F1",
};

const cardText = { margin: 0, font: `400 14px/1.6 ${JAK}`, color: "#8B9F93" };

const NAV = [
  ["#produto", "Produto"],
  ["#como", "Como funciona"],
  ["#seguranca", "Segurança"],
  ["#faq", "Dúvidas"],
];

const HERO_CHECKS = [
  "Sem cartão de crédito",
  "No ar em 3 minutos",
  "Dados em conformidade com a LGPD",
];

const METRICS = [
  ["+412 mil", "conversas atendidas pela IA"],
  ["7 s", "tempo médio da primeira resposta"],
  ["3,1×", "mais leads qualificados por mês"],
  ["99,9%", "disponibilidade nos últimos 12 meses"],
];

const FEATURES = [
  [
    "01",
    "A IA conduz a conversa",
    "Persona, tom de voz, tópicos permitidos e guardrails definidos por você. " +
      "Ela atende do início ao fim e avisa o time quando precisa.",
  ],
  [
    "02",
    "Ritmo humano",
    "Indicador de “digitando…” e pausas proporcionais ao tamanho da resposta. " +
      "Ninguém percebe um robô respondendo em 200 ms.",
  ],
  [
    "03",
    "Coleta estruturada",
    "Você escolhe os campos; a IA devolve preenchidos. O lead fechado cai no " +
      "painel e chega no seu WhatsApp na hora.",
  ],
];

/** Fila do mini-painel: cor do ponto, nome, cor do nome, rótulo, cor, destaque */
const QUEUE = [
  ["#3DDC97", "Marina Duarte", "#DCEAE2", "IA", "#8CE7BC", true],
  ["#E0B95C", "Rafael Lima", "#B9C7BF", "escalado", "#9CA99F", false],
  ["#4A5B51", "Clínica Sorriso", "#B9C7BF", "fechado", "#9CA99F", false],
];

const STEPS = [
  [
    "PASSO 01",
    "Crie sua conta",
    "E-mail e senha. Sem cartão, sem instalação, sem reunião de vendas.",
    "0s",
  ],
  [
    "PASSO 02",
    "Conecte seu WhatsApp",
    "Um QR code no celular e o número já está no ar, com o histórico intacto.",
    "1.3s",
  ],
  [
    "PASSO 03",
    "Ajuste a IA",
    "Persona, limites e os campos que ela precisa coletar em cada conversa.",
    "2.6s",
  ],
];

const SECURITY = [
  [
    "Base legal e consentimento",
    "Aviso de tratamento na primeira mensagem e registro de consentimento por conversa.",
  ],
  [
    "Criptografia ponta a ponta do dado",
    "TLS 1.3 em trânsito e AES-256 em repouso, com chaves segregadas por conta.",
  ],
  [
    "Retenção configurável",
    "Você define o prazo de guarda e pode apagar conversas e leads a qualquer momento.",
  ],
  [
    "Trilha de auditoria",
    "Quem assumiu, quando respondeu e o que a IA fez — registrado por operador.",
  ],
];

const FAQ = [
  [
    "Meu número pode ser bloqueado?",
    "A IA responde no ritmo de uma pessoa, com pausas e limites de disparo por " +
      "minuto. Nada de envio em massa: ela só responde quem falou com você primeiro.",
  ],
  [
    "Preciso do WhatsApp Business API oficial?",
    "Não. Funciona no número que você já usa, conectado por QR code — sem " +
      "aprovação da Meta e sem perder o histórico das conversas.",
  ],
  [
    "E quando a IA não souber responder?",
    "Ela escala para o time. A conversa aparece marcada no painel, qualquer " +
      "operador assume e depois devolve o atendimento para a IA.",
  ],
  [
    "Quanto tempo leva para configurar?",
    "Cerca de três minutos até a primeira resposta automática. Refinar persona " +
      "e campos costuma levar mais uns 15 minutos.",
  ],
  [
    "Posso cancelar quando quiser?",
    "Sim, direto no painel, sem multa e sem ligação de retenção. Você leva seus " +
      "dados e o histórico exportado.",
  ],
];

/* Animações e os poucos seletores que estilo inline não alcança. */
const CSS = `
  html{scroll-behavior:smooth}
  @keyframes lpRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes lpPulseDot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
  @keyframes lpGlow{0%,100%{opacity:.35}50%{opacity:.6}}
  @keyframes lpSweep{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
  .lp ::selection{background:#3DDC97;color:#06110B}
  .lp summary::-webkit-details-marker{display:none}
  .lp details[open] .lp-chev{transform:rotate(45deg)}
  @media (max-width:860px){
    .lp img,.lp svg,.lp video{max-width:100%}
    .lp header nav{display:none}
    .lp header > div{padding-left:20px !important;padding-right:20px !important;gap:12px !important}
    .lp section{padding-left:20px !important;padding-right:20px !important}
    .lp [style*="grid-template-columns"]{grid-template-columns:minmax(0,1fr) !important;gap:28px !important}
    .lp h1{font-size:38px !important;line-height:1.08 !important}
    .lp h2{font-size:28px !important;line-height:1.15 !important}
  }
  @media (max-width:480px){
    .lp header > div > div button{padding:9px 12px !important}
  }
`;

export default function Landing({ onSignup, onLogin, showMetrics = true }) {
  return (
    <div
      className="lp"
      id="topo"
      style={{
        minHeight: "100vh",
        background: "#0A0E0C",
        color: "#E8EFEA",
        fontFamily: JAK,
        overflowX: "hidden",
      }}
    >
      <style>{CSS}</style>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(14px)",
          background: "rgba(10,14,12,.78)",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <div
          style={{
            ...shell,
            padding: "0 32px",
            height: 68,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <a
            href="#topo"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#E8EFEA",
            }}
          >
            <img src="/public/logo.svg" height={60} alt="Logo" />
            {/* <Mark />
            <span
              style={{ font: `700 15.5px/1 ${JAK}`, letterSpacing: "-.01em" }}
            >
              Emerson
            </span> */}
          </a>

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              font: `500 13.5px/1 ${JAK}`,
            }}
          >
            {NAV.map(([href, label]) => (
              <a key={href} href={href} style={{ color: "#93A79B" }}>
                {label}
              </a>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Hover
              onClick={onLogin}
              hoverStyle={HOVER_GHOST}
              style={{
                ...btnGhost("9px 16px", 13.5),
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.12)",
              }}
            >
              Entrar
            </Hover>
            <Hover
              onClick={onSignup}
              hoverStyle={HOVER_PRI}
              style={{
                ...btnPri(
                  "10px 17px",
                  13.5,
                  "0 8px 24px -10px rgba(61,220,151,.8)",
                ),
                borderRadius: 10,
              }}
            >
              Criar conta
            </Hover>
          </div>
        </div>
      </header>

      {/* ---- hero ---- */}
      <section style={{ position: "relative", padding: "96px 32px 88px" }}>
        <div
          style={{
            position: "absolute",
            inset: "-120px 0 auto 0",
            height: 520,
            background:
              "radial-gradient(60% 70% at 50% 0%,rgba(61,220,151,.16),transparent 70%)",
            pointerEvents: "none",
            animation: "lpGlow 9s ease-in-out infinite",
          }}
        />
        <div
          style={{
            ...shell,
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1.05fr .95fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <div style={{ animation: "lpRise .6s ease both" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px 6px 8px",
                borderRadius: 999,
                border: "1px solid rgba(61,220,151,.25)",
                background: "rgba(61,220,151,.08)",
                font: `500 12px/1 ${MONO}`,
                color: "#8CE7BC",
                marginBottom: 26,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#3DDC97",
                  boxShadow: "0 0 0 4px rgba(61,220,151,.18)",
                }}
              />
              Funciona no seu próprio número
            </div>

            <h1
              style={{
                margin: "0 0 20px",
                font: `800 60px/1.04 ${JAK}`,
                letterSpacing: "-.033em",
                color: "#F3F8F4",
                textWrap: "balance",
              }}
            >
              Sua recepcionista de WhatsApp que nunca dorme
            </h1>

            <p
              style={{
                margin: "0 0 34px",
                maxWidth: 520,
                font: `400 17.5px/1.62 ${JAK}`,
                color: "#9CB0A4",
                textWrap: "pretty",
              }}
            >
              A ovelinha no seu tom, faz as perguntas certas, qualifica o
              cliente e chama seu time na hora certa. Você acompanha tudo por um
              painel em tempo real — sem perder nenhuma conversa.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 26,
              }}
            >
              <Hover
                onClick={onSignup}
                hoverStyle={HOVER_PRI}
                style={btnPri(
                  "15px 26px",
                  15,
                  "0 16px 40px -16px rgba(61,220,151,.9)",
                )}
              >
                Criar conta grátis
              </Hover>
              <Hover
                as="a"
                href="#como"
                hoverStyle={HOVER_GHOST}
                style={{
                  ...btnGhost("15px 24px", 15),
                  display: "inline-block",
                }}
              >
                Ver como funciona
              </Hover>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
                font: `400 13px/1 ${JAK}`,
                color: "#7C9086",
              }}
            >
              {HERO_CHECKS.map((c) => (
                <span
                  key={c}
                  style={{ display: "flex", alignItems: "center", gap: 7 }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: "1.5px solid rgba(61,220,151,.5)",
                    }}
                  />
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* mock da conversa */}
          <div
            style={{
              position: "relative",
              animation: "lpRise .7s .1s ease both",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "8% -6% -8% 6%",
                borderRadius: 28,
                background:
                  "linear-gradient(160deg,rgba(61,220,151,.18),transparent 60%)",
                filter: "blur(30px)",
              }}
            />
            <div
              style={{
                position: "relative",
                borderRadius: 24,
                border: "1px solid rgba(255,255,255,.1)",
                background: "#101613",
                boxShadow: "0 40px 80px -40px rgba(0,0,0,.9)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "14px 18px",
                  borderBottom: "1px solid rgba(255,255,255,.07)",
                  background: "rgba(255,255,255,.02)",
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "linear-gradient(150deg,#2A6E52,#153D2D)",
                    display: "grid",
                    placeItems: "center",
                    font: `700 12px/1 ${JAK}`,
                    color: "#9FE8C4",
                  }}
                >
                  CL
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ font: `600 13.5px/1.3 ${JAK}`, color: "#E8EFEA" }}
                  >
                    Cliente novo
                  </div>
                  <div
                    style={{ font: `400 11.5px/1.3 ${MONO}`, color: "#6F8478" }}
                  >
                    +55 11 9 ••••-4471
                  </div>
                </div>
                <span
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: "rgba(61,220,151,.12)",
                    border: "1px solid rgba(61,220,151,.22)",
                    font: `500 10.5px/1 ${MONO}`,
                    color: "#8CE7BC",
                  }}
                >
                  IA no comando
                </span>
              </div>

              <div
                style={{
                  padding: "20px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "#0C110F",
                }}
              >
                <div
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "76%",
                    padding: "11px 14px",
                    borderRadius: "14px 14px 14px 4px",
                    background: "#18211D",
                    font: `400 13.5px/1.5 ${JAK}`,
                    color: "#D6E3DA",
                    animation: "lpRise .5s .2s ease both",
                  }}
                >
                  Oi, vocês atendem hoje ainda?
                </div>
                <div
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "80%",
                    padding: "11px 14px",
                    borderRadius: "14px 14px 4px 14px",
                    background: "#1E6A4C",
                    font: `400 13.5px/1.5 ${JAK}`,
                    color: "#EAFBF2",
                    animation: "lpRise .5s .7s ease both",
                  }}
                >
                  Oi! Atendemos sim 🙂 Pra eu já reservar, qual é o seu nome
                  completo?
                </div>
                <div
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "76%",
                    padding: "11px 14px",
                    borderRadius: "14px 14px 14px 4px",
                    background: "#18211D",
                    font: `400 13.5px/1.5 ${JAK}`,
                    color: "#D6E3DA",
                    animation: "lpRise .5s 1.2s ease both",
                  }}
                >
                  Marina Duarte, pode ser 16h?
                </div>
                <div
                  style={{
                    alignSelf: "flex-end",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "12px 15px",
                    borderRadius: "14px 14px 4px 14px",
                    background: "#1E6A4C",
                    animation: "lpRise .5s 1.7s ease both",
                  }}
                >
                  {[0, 0.2, 0.4].map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#BFF4DA",
                        animation: `lpPulseDot 1.2s ${d}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: "14px 18px",
                  borderTop: "1px solid rgba(255,255,255,.07)",
                  background: "rgba(255,255,255,.02)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ font: `500 11px/1 ${MONO}`, color: "#6F8478" }}>
                  LEAD CAPTURADO
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    font: `500 11.5px/1 ${MONO}`,
                  }}
                >
                  <span
                    style={{
                      padding: "5px 9px",
                      borderRadius: 7,
                      background: "rgba(61,220,151,.1)",
                      color: "#8CE7BC",
                    }}
                  >
                    nome ✓
                  </span>
                  <span
                    style={{
                      padding: "5px 9px",
                      borderRadius: 7,
                      background: "rgba(61,220,151,.1)",
                      color: "#8CE7BC",
                    }}
                  >
                    telefone ✓
                  </span>
                  <span
                    style={{
                      padding: "5px 9px",
                      borderRadius: 7,
                      background: "rgba(255,255,255,.05)",
                      color: "#7C9086",
                    }}
                  >
                    horário …
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- números ---- */}
      {showMetrics && (
        <section style={{ padding: "0 32px 92px" }}>
          <div
            style={{
              ...shell,
              borderTop: "1px solid rgba(255,255,255,.07)",
              borderBottom: "1px solid rgba(255,255,255,.07)",
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
            }}
          >
            {METRICS.map(([value, label], i) => (
              <div
                key={label}
                style={{
                  padding: "32px 28px",
                  borderRight:
                    i < METRICS.length - 1
                      ? "1px solid rgba(255,255,255,.07)"
                      : undefined,
                }}
              >
                <div
                  style={{
                    font: `800 34px/1 ${JAK}`,
                    color: "#F3F8F4",
                    letterSpacing: "-.03em",
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    font: `400 13px/1.5 ${JAK}`,
                    color: "#83978B",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- produto ---- */}
      <section id="produto" style={{ padding: "0 32px 100px" }}>
        <div style={shell}>
          <div style={{ maxWidth: 620, marginBottom: 44 }}>
            <div style={eyebrow}>O PRODUTO</div>
            <h2 style={{ ...heading, marginBottom: 14 }}>
              Atendimento que parece gente, com o controle de um sistema
            </h2>
            <p
              style={{
                margin: 0,
                font: `400 16px/1.6 ${JAK}`,
                color: "#93A79B",
                textWrap: "pretty",
              }}
            >
              Você define a persona, os limites e o que precisa saber de cada
              cliente. A IA cuida do resto e passa o bastão quando o assunto
              exige um humano.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 18,
            }}
          >
            {FEATURES.map(([n, title, desc]) => (
              <Hover as="div" key={n} style={cardBase} hoverStyle={HOVER_CARD}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: "rgba(61,220,151,.1)",
                    border: "1px solid rgba(61,220,151,.2)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 18,
                    font: `500 15px/1 ${MONO}`,
                    color: "#8CE7BC",
                  }}
                >
                  {n}
                </div>
                <h3 style={cardTitle}>{title}</h3>
                <p style={cardText}>{desc}</p>
              </Hover>
            ))}
          </div>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              // gridTemplateColumns: "1.15fr .85fr",
              gap: 18,
            }}
          >
            {/* <div
              style={{
                padding: 28,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.08)",
                background: "linear-gradient(140deg,#121A16,#0D1210)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ ...cardTitle, font: `700 19px/1.3 ${JAK}` }}>
                  Painel multi-operador
                </h3>
                <p style={cardText}>
                  Conversas em tempo real, assumir e devolver o atendimento,
                  chip de escalada e histórico completo — tudo em cima do seu
                  próprio número.
                </p>
              </div>
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "#0B100E",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                }}
              >
                {QUEUE.map(([dot, name, nameColor, tag, tagColor, active]) => (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 11px",
                      borderRadius: 9,
                      background: active
                        ? "rgba(61,220,151,.08)"
                        : "rgba(255,255,255,.03)",
                      border: active
                        ? "1px solid rgba(61,220,151,.18)"
                        : undefined,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: dot,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        font: `600 12px/1 ${JAK}`,
                        color: nameColor,
                      }}
                    >
                      {name}
                    </span>
                    <span
                      style={{ font: `500 10.5px/1 ${MONO}`, color: tagColor }}
                    >
                      {tag}
                    </span>
                  </div>
                ))}
              </div>
            </div> */}

            <div
              style={{
                display: "flex",
                padding: 28,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.08)",
                background: "linear-gradient(140deg,#121A16,#0D1210)",
              }}
            >
              <div>
                <h3 style={{ ...cardTitle, font: `700 19px/1.3 ${JAK}` }}>
                  Seu número, sua conta
                </h3>
                <p style={{ ...cardText, marginBottom: 18 }}>
                  Sem migrar para número oficial da Meta, sem perder histórico e
                  sem depender de aprovação. Conecta com um QR code.
                </p>
              </div>

              <div
                style={{
                  width: 160,
                  height: 120,
                  borderRadius: 12,
                  border: "1px dashed rgba(255,255,255,.14)",
                  background: "#fff",
                  backgroundImage: 'url("/qr-code.png")',
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "120px 120px",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---- como funciona ---- */}
      <section
        id="como"
        style={{
          padding: "88px 32px",
          borderTop: "1px solid rgba(255,255,255,.07)",
          background: "linear-gradient(180deg,#0C110F,#0A0E0C)",
        }}
      >
        <div style={shell}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 40,
              marginBottom: 44,
            }}
          >
            <div style={{ maxWidth: 560 }}>
              <div style={eyebrow}>COMO FUNCIONA</div>
              <h2 style={heading}>No ar em três passos</h2>
            </div>
            <Hover
              onClick={onSignup}
              hoverStyle={HOVER_GHOST}
              style={{ ...btnGhost("13px 22px", 14), borderRadius: 11 }}
            >
              Começar agora
            </Hover>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 18,
            }}
          >
            {STEPS.map(([step, title, desc, delay]) => (
              <div
                key={step}
                style={{
                  position: "relative",
                  padding: 28,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "#101614",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background:
                      "linear-gradient(90deg,transparent,rgba(61,220,151,.7),transparent)",
                    width: "40%",
                    animation: `lpSweep 4s ${delay} linear infinite`,
                  }}
                />
                <div
                  style={{
                    font: `500 12px/1 ${MONO}`,
                    color: "#3DDC97",
                    marginBottom: 16,
                  }}
                >
                  {step}
                </div>
                <h3
                  style={{
                    margin: "0 0 8px",
                    font: `700 18px/1.3 ${JAK}`,
                    color: "#EFF5F1",
                  }}
                >
                  {title}
                </h3>
                <p style={cardText}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- segurança ---- */}
      <section
        id="seguranca"
        style={{
          padding: "88px 32px",
          borderTop: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <div
          style={{
            ...shell,
            display: "grid",
            gridTemplateColumns: ".9fr 1.1fr",
            gap: 60,
            alignItems: "start",
          }}
        >
          <div>
            <div style={eyebrow}>SEGURANÇA E LGPD</div>
            <h2
              style={{
                ...heading,
                marginBottom: 14,
                font: `700 36px/1.16 ${JAK}`,
              }}
            >
              Conversa de cliente é dado sensível. Tratamos como tal.
            </h2>
            <p
              style={{
                margin: 0,
                font: `400 15.5px/1.65 ${JAK}`,
                color: "#93A79B",
                textWrap: "pretty",
              }}
            >
              Infraestrutura em nuvem no Brasil, criptografia em trânsito e em
              repouso, e controle total sobre o que é armazenado e por quanto
              tempo.
            </p>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            {SECURITY.map(([title, desc]) => (
              <div
                key={title}
                style={{
                  padding: 22,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "#101614",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 7px",
                    font: `700 15px/1.3 ${JAK}`,
                    color: "#EFF5F1",
                  }}
                >
                  {title}
                </h3>
                <p style={{ ...cardText, font: `400 13.5px/1.6 ${JAK}` }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- dúvidas ---- */}
      <section
        id="faq"
        style={{
          padding: "88px 32px",
          borderTop: "1px solid rgba(255,255,255,.07)",
          background: "#0C110F",
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <h2
            style={{
              ...heading,
              margin: "0 0 34px",
              font: `700 34px/1.18 ${JAK}`,
              textAlign: "center",
            }}
          >
            Dúvidas antes de começar
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ.map(([q, a], i) => (
              <details
                key={q}
                open={i === 0}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "#101614",
                  padding: "0 20px",
                }}
              >
                <summary
                  style={{
                    listStyle: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 20,
                    padding: "19px 0",
                    font: `600 16px/1.4 ${JAK}`,
                    color: "#EFF5F1",
                  }}
                >
                  {q}
                  <span
                    className="lp-chev"
                    style={{
                      width: 9,
                      height: 9,
                      flex: "none",
                      borderRight: "2px solid #6F8478",
                      borderBottom: "2px solid #6F8478",
                      transform: "rotate(-45deg)",
                      transition: "transform .2s",
                    }}
                  />
                </summary>
                <p
                  style={{
                    margin: 0,
                    padding: "0 0 20px",
                    font: `400 14.5px/1.65 ${JAK}`,
                    color: "#8B9F93",
                  }}
                >
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA final ---- */}
      <section
        style={{
          padding: "96px 32px",
          borderTop: "1px solid rgba(255,255,255,.07)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "auto 0 -240px 0",
            height: 460,
            background:
              "radial-gradient(50% 60% at 50% 100%,rgba(61,220,151,.16),transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 760,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              font: `800 44px/1.1 ${JAK}`,
              letterSpacing: "-.03em",
              color: "#F3F8F4",
              textWrap: "balance",
            }}
          >
            Conecte seu número e veja a IA atendendo hoje
          </h2>
          <p
            style={{
              margin: "0 0 30px",
              font: `400 17px/1.6 ${JAK}`,
              color: "#93A79B",
            }}
          >
            O cadastro leva um minuto. Depois é só ler o QR code — a partir daí
            ela já responde.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Hover
              onClick={onSignup}
              hoverStyle={HOVER_PRI}
              style={btnPri(
                "16px 30px",
                15.5,
                "0 18px 44px -18px rgba(61,220,151,.9)",
              )}
            >
              Criar minha conta
            </Hover>
            <Hover
              onClick={onLogin}
              hoverStyle={HOVER_GHOST}
              style={btnGhost("16px 26px", 15.5)}
            >
              Já tenho conta
            </Hover>
          </div>
        </div>
      </section>

      <footer
        style={{
          padding: "36px 32px",
          borderTop: "1px solid rgba(255,255,255,.07)",
          background: "#0A0E0C",
        }}
      >
        <div
          style={{
            ...shell,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/public/logo.svg" height={60} alt="Logo" />
          </div>
          <div style={{ display: "flex", gap: 24, font: `400 13px/1 ${JAK}` }}>
            <a href="#seguranca" style={{ color: "#7C9086" }}>
              Segurança
            </a>
            <a href="#faq" style={{ color: "#7C9086" }}>
              Dúvidas
            </a>
            <a href="#topo" style={{ color: "#7C9086" }}>
              Termos
            </a>
            <a href="#topo" style={{ color: "#7C9086" }}>
              Privacidade
            </a>
          </div>
          <div style={{ font: `400 12.5px/1 ${JAK}`, color: "#5F7168" }}>
            © 2026 Sheep · Atendimento por WhatsApp com IA
          </div>
        </div>
      </footer>
    </div>
  );
}
