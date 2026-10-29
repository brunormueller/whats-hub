import { useCallback, useEffect, useState } from "react";
import {
  Hover,
  HOVER_MUTED,
  Switch,
  pill,
  card,
  btnPrimary,
  btnGhost,
  inputStyle,
} from "../ui.jsx";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DURATIONS = [15, 30, 45, 60, 90, 120];

/** Lê (e limpa da URL) o resultado da volta do OAuth: ?google=connected|error */
function takeReturnNotice() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("google");
  if (!status) return null;

  const notice =
    status === "connected"
      ? { kind: "ok", text: "Google Calendar conectado." }
      : { kind: "bad", text: params.get("reason") || "Não foi possível conectar o Google." };

  window.history.replaceState(null, "", window.location.pathname);
  return notice;
}

const label = { fontSize: 12, color: "var(--mfg)", marginBottom: 5, display: "block" };

export default function GoogleCalendarCard({ authFetch }) {
  const [status, setStatus] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(takeReturnNotice);

  const load = useCallback(async () => {
    try {
      const res = await authFetch("/api/google/status");
      const data = await res.json();
      setStatus(data);
      setDraft(data.settings);
    } catch {
      setStatus({ error: true });
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await authFetch("/api/google/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setNotice({ kind: "bad", text: err.message || "Falha ao iniciar a conexão." });
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await authFetch("/api/google", { method: "DELETE" }).catch(() => {});
    setNotice({ kind: "ok", text: "Google desconectado." });
    await load();
    setBusy(false);
  };

  const save = async (patch = {}) => {
    setBusy(true);
    try {
      const res = await authFetch("/api/google/settings", {
        method: "PUT",
        body: JSON.stringify({ ...draft, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus((s) => ({ ...s, settings: data.settings }));
      setDraft(data.settings);
      setNotice({ kind: "ok", text: "Ajustes de agenda salvos." });
    } catch (err) {
      setNotice({ kind: "bad", text: err.message || "Não foi possível salvar." });
    }
    setBusy(false);
  };

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleDay = (day) =>
    set(
      "days",
      draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day].sort(),
    );

  const dirty = status?.settings && JSON.stringify(draft) !== JSON.stringify(status.settings);

  let badge = ["Verificando…", "mut"];
  if (status?.error) badge = ["Erro", "bad"];
  else if (status) badge = status.connected ? ["Conectado", "ok"] : ["Não conectado", "warn"];

  return (
    <div
      style={{
        ...card,
        padding: "16px 17px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: "var(--muted)",
            display: "grid",
            placeItems: "center",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--mfg)",
          }}
        >
          G
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>Google Calendar</span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--mfg)", marginTop: 2 }}>
            {status?.connected
              ? status.email || "Conta conectada"
              : "A IA marca reuniões direto na sua agenda."}
          </span>
        </span>
        <span style={pill(badge[1])}>{badge[0]}</span>
      </div>

      {notice && (
        <div style={{ ...pill(notice.kind), alignSelf: "flex-start", height: "auto", padding: "5px 10px", whiteSpace: "normal" }}>
          {notice.text}
        </div>
      )}

      {status && !status.error && !status.configured && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--mfg)" }}>
          O servidor ainda não tem as credenciais do Google (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e
          GOOGLE_REDIRECT_URI).
        </p>
      )}

      {status?.configured && !status.connected && (
        <div>
          <button style={btnPrimary(34, 15)} onClick={connect} disabled={busy}>
            Conectar Google
          </button>
        </div>
      )}

      {status?.connected && draft && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--bd)",
            }}
          >
            <span style={{ flex: 1, fontSize: 13 }}>
              <span style={{ display: "block", fontWeight: 500 }}>IA agenda sozinha</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--mfg)", marginTop: 2 }}>
                Oferece horários livres e cria o evento quando o cliente confirma.
              </span>
            </span>
            <Switch
              on={draft.enabled}
              title="Ligar agendamento"
              onChange={() => save({ enabled: !draft.enabled })}
            />
          </div>

          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
            <label>
              <span style={label}>Duração</span>
              <select
                style={inputStyle}
                value={draft.durationMin}
                onChange={(e) => set("durationMin", Number(e.target.value))}
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={label}>Antecedência mínima</span>
              <select
                style={inputStyle}
                value={draft.minNoticeMin}
                onChange={(e) => set("minNoticeMin", Number(e.target.value))}
              >
                {[0, 60, 120, 240, 720, 1440].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "Sem antecedência" : m < 1440 ? `${m / 60} h` : "1 dia"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={label}>Expediente — início</span>
              <input
                type="time"
                style={inputStyle}
                value={draft.start}
                onChange={(e) => set("start", e.target.value)}
              />
            </label>
            <label>
              <span style={label}>Expediente — fim</span>
              <input
                type="time"
                style={inputStyle}
                value={draft.end}
                onChange={(e) => set("end", e.target.value)}
              />
            </label>
          </div>

          <div>
            <span style={label}>Dias de atendimento</span>
            <div className="tap" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {WEEKDAYS.map((name, day) => {
                const on = draft.days.includes(day);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{
                      ...btnGhost(31, 12),
                      ...(on ? { background: "var(--pri)", color: "var(--prifg)", borderColor: "var(--pri)" } : {}),
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <label>
            <span style={label}>Título do evento ({"{nome}"} vira o nome do cliente)</span>
            <input
              style={inputStyle}
              value={draft.eventTitle}
              maxLength={120}
              onChange={(e) => set("eventTitle", e.target.value)}
            />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...btnPrimary(34, 15), opacity: dirty && !busy ? 1 : 0.5 }}
              disabled={!dirty || busy}
              onClick={() => save()}
            >
              Salvar ajustes
            </button>
            <Hover
              style={{ ...btnGhost(34, 13), background: "transparent", color: "var(--mfg)", fontWeight: 400 }}
              hoverStyle={HOVER_MUTED}
              onClick={disconnect}
              disabled={busy}
            >
              Desconectar
            </Hover>
          </div>
        </>
      )}
    </div>
  );
}
