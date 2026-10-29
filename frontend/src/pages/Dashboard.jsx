import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSocket } from "../hooks/useSocket.js";
import { useInstance } from "../hooks/useInstance.js";
import Sidebar from "../components/Sidebar.jsx";
import ConnectModal from "../components/ConnectModal.jsx";
import Metrics from "./Metrics.jsx";
import Inbox from "./Inbox.jsx";
import AiSettings from "./AiSettings.jsx";
import Team from "./Team.jsx";
import Channels from "./Channels.jsx";
import { AI_DEFAULTS } from "../data/defaults.js";

// Título da barra superior no celular (a sidebar fica escondida na gaveta)
const SCREEN_TITLES = {
  dashboard: "Painel",
  channels: "Canais",
  ai: "Comportamento da IA",
};

/**
 * Painel da conta logada.
 *
 * Só renderiza depois do gate de onboarding (ver App.jsx): aqui já existe
 * conta com WhatsApp conectado, então todas as rotas de API respondem.
 */
export default function Dashboard({
  account,
  token,
  authFetch,
  theme,
  onToggleTheme,
  onLogout,
}) {
  // Estado da conexão para a tela de Canais e para o rótulo do número.
  const instance = useInstance(authFetch);

  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);

  // Volta do OAuth do Google (?google=…) cai direto na tela de canais
  const [screen, setScreen] = useState(() =>
    new URLSearchParams(window.location.search).has("google") ? "channels" : "dashboard",
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [convMeta, setConvMeta] = useState({});

  const [ai, setAi] = useState(AI_DEFAULTS);
  const [aiPublished, setAiPublished] = useState(AI_DEFAULTS);
  const [aiRuntime, setAiRuntime] = useState(null);

  const [connectOpen, setConnectOpen] = useState(false);
  const [instanceLog, setInstanceLog] = useState([]);

  // Comportamento da IA publicado no backend (é o que o webhook usa)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await authFetch("/api/ai/config");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { runtime, ...config } = await res.json();
        if (cancelled) return;

        const merged = { ...AI_DEFAULTS, ...config };
        setAi(merged);
        setAiPublished(merged);
        setAiRuntime(runtime || null);
        setAiEnabled(merged.autoReply !== false);
      } catch (err) {
        console.warn("Configuração da IA não carregou:", err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function putAiConfig(body) {
    const res = await authFetch("/api/ai/config", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { runtime, ...config } = await res.json();
    return { config: { ...AI_DEFAULTS, ...config }, runtime };
  }

  async function publishAi() {
    try {
      const { config, runtime } = await putAiConfig(ai);
      setAi(config);
      setAiPublished(config);
      setAiRuntime(runtime || null);
      setAiEnabled(config.autoReply !== false);
    } catch (err) {
      console.error("Falha ao publicar o comportamento da IA:", err.message);
    }
  }

  // O switch "IA ativa" liga/desliga a resposta automática de verdade
  async function toggleAi() {
    const next = !aiEnabled;
    setAiEnabled(next);
    setAi((prev) => ({ ...prev, autoReply: next }));
    setAiPublished((prev) => ({ ...prev, autoReply: next }));

    try {
      await putAiConfig({ autoReply: next });
    } catch (err) {
      console.error("Falha ao alternar a IA:", err.message);
      setAiEnabled(!next);
      setAi((prev) => ({ ...prev, autoReply: !next }));
      setAiPublished((prev) => ({ ...prev, autoReply: !next }));
    }
  }

  // Histórico de transições da conexão (alimenta o painel "Logs" em Canais)
  const lastState = useRef(null);
  useEffect(() => {
    if (instance.state === "loading" || instance.state === lastState.current)
      return;
    lastState.current = instance.state;
    setInstanceLog((prev) =>
      [{ at: new Date().toISOString(), state: instance.state }, ...prev].slice(
        0,
        50,
      ),
    );
  }, [instance.state]);

  const socket = useSocket(token, {
    "conversations:list": (list) => setConversations(list),

    "message:new": (msg) => {
      if (msg.from === selected || msg.direction === "outbound") {
        setMessages((prev) => [...prev, msg]);
      }
    },

    // O patch pode trazer só algumas chaves (ex.: { aiPaused } após handoff),
    // então mescla com o que já existe em vez de substituir a conversa.
    "conversation:updated": (patch) => {
      const { phoneNumber, unread } = patch;
      setConversations((prev) => {
        const exists = prev.find((c) => c.phoneNumber === phoneNumber);
        const updated = {
          ...exists,
          ...patch,
          unread:
            phoneNumber === selected ? 0 : (unread ?? exists?.unread ?? 0),
        };
        if (exists)
          return [
            updated,
            ...prev.filter((c) => c.phoneNumber !== phoneNumber),
          ];
        return [updated, ...prev];
      });
    },
  });

  const selectConversation = useCallback(
    async (phoneNumber) => {
      if (selected) socket.emit("conversation:leave", selected);
      setSelected(phoneNumber);
      socket.emit("conversation:join", phoneNumber);
      socket.emit("conversation:read", phoneNumber);

      const res = await authFetch(`/api/messages/${phoneNumber}`);
      setMessages(res.ok ? await res.json() : []);

      setConversations((prev) =>
        prev.map((c) =>
          c.phoneNumber === phoneNumber ? { ...c, unread: 0 } : c,
        ),
      );
    },
    [selected, socket, authFetch],
  );

  async function sendMessage(text) {
    if (!selected || !text.trim()) return;
    await authFetch(`/api/messages/${selected}`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    // A mensagem volta pelo socket (broadcastMessage) — não adiciona aqui
  }

  // Pausa/reativa a IA em UMA conversa (o switch do ContactPanel é o global).
  // O estado volta pelo socket em conversation:updated, então não faz update
  // otimista aqui.
  const setConvAi = useCallback(
    async (phoneNumber, action) => {
      try {
        const res = await authFetch(
          `/api/ai/conversations/${phoneNumber}/${action}`,
          { method: "POST" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error(`Falha em ${action} da IA na conversa:`, err.message);
      }
    },
    [authFetch],
  );

  const pauseConv = useCallback((p) => setConvAi(p, "pause"), [setConvAi]);
  const resumeConv = useCallback((p) => setConvAi(p, "resume"), [setConvAi]);

  // Mensagem nova reabre uma conversa marcada como resolvida
  useEffect(() => {
    setConvMeta((prev) => {
      const reopen = conversations.filter(
        (c) => c.unread > 0 && prev[c.phoneNumber]?.resolved,
      );
      if (reopen.length === 0) return prev;
      const next = { ...prev };
      reopen.forEach((c) => {
        next[c.phoneNumber] = { ...next[c.phoneNumber], resolved: false };
      });
      return next;
    });
  }, [conversations]);

  const patchMeta = useCallback((phoneNumber, patch) => {
    setConvMeta((prev) => ({
      ...prev,
      [phoneNumber]: { ...prev[phoneNumber], ...patch },
    }));
  }, []);

  const unread = useMemo(
    () => conversations.reduce((n, c) => n + (c.unread || 0), 0),
    [conversations],
  );

  const aiDirty = JSON.stringify(ai) !== JSON.stringify(aiPublished);

  return (
    <div
      className="app-shell"
      style={{
        display: "flex",
        height: "100vh",
        minHeight: 820,
        width: "100%",
        minWidth: 1440,
        background: "var(--bg)",
        color: "var(--fg)",
        fontSize: 14,
      }}
    >
      {/* Só aparecem até 960px (index.html): a sidebar vira gaveta. */}
      <div className="app-topbar">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        <span>{SCREEN_TITLES[screen]}</span>
      </div>
      <div
        className={`app-backdrop${menuOpen ? " is-open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <Sidebar
        open={menuOpen}
        screen={screen}
        onScreen={(next) => {
          setScreen(next);
          setMenuOpen(false);
        }}
        account={account}
        theme={theme}
        onToggleTheme={onToggleTheme}
        unread={unread}
        onLogout={onLogout}
        aiEnabled={aiEnabled}
        onToggleAi={toggleAi}
      />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
        }}
      >
        {screen === "dashboard" && <Metrics authFetch={authFetch} />}

        {/* {screen === "inbox" && (
          <Inbox
            conversations={conversations}
            selected={selected}
            onSelect={selectConversation}
            messages={messages}
            onSend={sendMessage}
            aiEnabled={aiEnabled}
            onToggleAi={toggleAi}
            onPauseConv={pauseConv}
            onResumeConv={resumeConv}
            convMeta={convMeta}
            onPatchMeta={patchMeta}
            ai={ai}
            onGoSettings={() => setScreen("ai")}
            channelPhone={instance.instanceName}
          />
        )}

        {screen === "team" && <Team />} */}

        {screen === "ai" && (
          <AiSettings
            ai={ai}
            onChange={(patch) => setAi((prev) => ({ ...prev, ...patch }))}
            dirty={aiDirty}
            onPublish={publishAi}
            onDiscard={() => setAi(aiPublished)}
            authFetch={authFetch}
            runtime={aiRuntime}
          />
        )}

        {screen === "channels" && (
          <Channels
            instanceState={instance.state}
            channelPhone={instance.instanceName}
            conversationCount={conversations.length}
            aiEnabled={aiEnabled}
            log={instanceLog}
            onConnect={() => setConnectOpen(true)}
            onConfigure={() => setScreen("ai")}
            authFetch={authFetch}
          />
        )}
      </main>

      {/* Reconexão pontual. O pareamento obrigatório é a tela de onboarding. */}
      {connectOpen && (
        <ConnectModal
          state={instance.state}
          qrcode={instance.qrcode}
          pairingCode={instance.pairingCode}
          error={instance.error}
          qrError={instance.qrError}
          onRefresh={instance.refreshQr}
          onPairingCode={instance.requestPairingCode}
          onClose={() => setConnectOpen(false)}
        />
      )}
    </div>
  );
}
