import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Hover,
  HOVER_MUTED,
  card,
  pill,
  MONO,
  btnGhost,
  formatPhone,
  clockTime,
} from "../ui.jsx";

/**
 * Painel de métricas da conta.
 *
 * Duas séries diárias — conversas e leads fechados — em barras agrupadas no
 * MESMO eixo: são a mesma unidade (contagem por dia), então dois eixos y
 * seriam mentira. As duas cores foram validadas para daltonismo e contraste
 * nos temas claro e escuro (mesmo par serve os dois).
 */

const SERIES = [
  { key: "conversations", label: "Conversas", color: "#6366f1" },
  { key: "leads", label: "Leads fechados", color: "#0d9e6e" },
];

const RANGES = [7, 14, 30];

const label = { fontSize: 12, color: "var(--mfg)" };

function StatTile({ title, value, sub, tone }) {
  return (
    <div style={{ ...card, padding: "15px 17px" }}>
      <div style={{ ...label, display: "flex", alignItems: "center", gap: 7 }}>
        {title}
        {tone && <span style={pill(tone.kind)}>{tone.text}</span>}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 27,
          fontWeight: 600,
          letterSpacing: "-.02em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--mfg)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** dd/mm a partir de '2026-07-31' */
function dayLabel(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Chart({ series, days }) {
  const [hover, setHover] = useState(null);

  const max = Math.max(1, ...series.flatMap((d) => [d.conversations, d.leads]));
  // Escala com folga em cima para o rótulo não colar no topo da caixa
  const top = Math.ceil(max * 1.15) || 1;
  const ticks = [top, Math.round(top / 2), 0];

  // Em 30 dias não cabe um rótulo por coluna — mostra de 3 em 3.
  const step = days > 20 ? 3 : days > 10 ? 2 : 1;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 10 }}>
        {/* eixo y, recessivo */}
        <div
          style={{
            width: 26,
            height: 190,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 10.5,
            color: "var(--mfg)",
            fontFamily: MONO,
            paddingBottom: 18,
          }}
        >
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
          {/* grade */}
          <div
            style={{
              position: "absolute",
              inset: "0 0 18px 0",
              pointerEvents: "none",
            }}
          >
            {[0, 0.5, 1].map((f) => (
              <div
                key={f}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${f * 100}%`,
                  borderTop: "1px solid var(--bd)",
                  opacity: f === 1 ? 1 : 0.55,
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 3,
              height: 190,
            }}
          >
            {series.map((day, i) => {
              const on = hover === i;
              return (
                <div
                  key={day.day}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    borderRadius: 4,
                    background: on ? "var(--muted)" : "transparent",
                  }}
                >
                  {/* barras agrupadas: 2px de superfície entre as duas */}
                  <div
                    style={{
                      display: "flex",
                      gap: 2,
                      alignItems: "flex-end",
                      height: 172,
                      padding: "0 2px",
                    }}
                  >
                    {SERIES.map((s) => (
                      <div
                        key={s.key}
                        title={`${s.label}: ${day[s.key]}`}
                        style={{
                          flex: 1,
                          height: `${(day[s.key] / top) * 100}%`,
                          minHeight: day[s.key] > 0 ? 3 : 0,
                          background: s.color,
                          borderRadius: "4px 4px 0 0",
                        }}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      height: 18,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 9.5,
                      color: "var(--mfg)",
                      fontFamily: MONO,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {i % step === 0 ? dayLabel(day.day) : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {hover !== null && (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: 0,
            ...card,
            padding: "8px 11px",
            fontSize: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 5 }}>
            {dayLabel(series[hover].day)}
          </div>
          {SERIES.map((s) => (
            <div
              key={s.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 2,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: s.color,
                }}
              />
              <span style={{ color: "var(--mfg)" }}>{s.label}</span>
              <span style={{ fontFamily: MONO, fontWeight: 500 }}>
                {series[hover][s.key]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Metrics({ authFetch, onGoInbox }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/metrics?days=${days}`);
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`,
        );
      setData(await res.json());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, days]);

  useEffect(() => {
    load();
  }, [load]);

  const leadColumns = useMemo(() => {
    const first = data?.recentLeads?.[0];
    if (!first) return [];
    return Object.keys(first.fields || {}).slice(0, 3);
  }, [data]);

  const c = data?.conversations;
  const l = data?.leads;

  const trend =
    c && c.yesterday > 0
      ? `${c.today >= c.yesterday ? "+" : ""}${Math.round(((c.today - c.yesterday) / c.yesterday) * 100)}% vs. ontem`
      : "sem base de comparação ainda";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <header
        style={{
          flex: "none",
          padding: "20px 28px 18px",
          borderBottom: "1px solid var(--bd)",
          background: "var(--bg)",
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <h1
            style={{
              margin: "0 0 4px",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-.02em",
            }}
          >
            Painel
          </h1>
          <p style={{ margin: 0, ...label, maxWidth: 620, textWrap: "pretty" }}>
            Volume de atendimento e leads coletados pela IA. Calculado sobre as
            conversas desta conta, sem amostragem.
          </p>
        </div>

        {/* filtros em uma linha, acima dos gráficos */}
        <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              style={{
                height: 30,
                padding: "0 11px",
                borderRadius: 7,
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 500,
                border: `1px solid ${days === r ? "transparent" : "var(--bd)"}`,
                background: days === r ? "var(--pri)" : "transparent",
                color: days === r ? "var(--prifg)" : "var(--fg)",
              }}
            >
              {r}d
            </button>
          ))}
          <Hover
            onClick={load}
            style={{ ...btnGhost(30, 11), background: "transparent" }}
            hoverStyle={HOVER_MUTED}
          >
            {loading ? "…" : "↻"}
          </Hover>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "20px 28px 40px",
        }}
      >
        {error && (
          <div
            style={{
              background: "var(--dangersoft)",
              color: "var(--danger)",
              fontSize: 12.5,
              padding: "11px 13px",
              borderRadius: 9,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {!data && !error && (
          <div style={{ ...label, padding: "40px 0", textAlign: "center" }}>
            carregando métricas…
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 14,
              }}
            >
              <StatTile title="Conversas hoje" value={c.today} sub={trend} />
              <StatTile
                title="Resolvidas pela IA"
                value={`${c.resolvedByAiPct}%`}
                sub={`${c.resolvedByAi} de ${c.total} conversas`}
              />
              <StatTile
                title="Leads fechados"
                value={l.closed}
                sub={`${l.today} hoje · ${l.inProgress} em coleta`}
              />
              <StatTile
                title="Conversão"
                value={`${l.conversionPct}%`}
                sub="conversas que viraram lead completo"
              />
            </div>

            <div style={{ ...card, padding: "18px 20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                    Conversas e leads por dia
                  </div>
                  <div style={{ ...label, marginTop: 3 }}>
                    Últimos {days} dias. Dias sem movimento aparecem vazios.
                  </div>
                </div>
                {/* legenda: identidade nunca só pela cor */}
                <div style={{ display: "flex", gap: 14 }}>
                  {SERIES.map((s) => (
                    <span
                      key={s.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 2,
                          background: s.color,
                        }}
                      />
                      <span style={{ color: "var(--mfg)" }}>{s.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              <Chart series={data.series} days={days} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              {/* <div style={{ ...card, padding: '16px 18px' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>
                  Estado das conversas
                </div>
                {[
                  ['Escaladas para humano', c.escalated, 'warn'],
                  ['Assumidas por operador', c.pausedByHuman, 'mut'],
                  ['Mensagens não lidas', c.unread, c.unread ? 'bad' : 'mut'],
                  ['Total de conversas', c.total, 'mut'],
                ].map(([title, value, kind]) => (
                  <div key={title} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 0', borderTop: '1px solid var(--bd)',
                  }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{title}</span>
                    <span style={pill(kind)}>{value}</span>
                  </div>
                ))}
              </div> */}

              <div style={{ ...card, padding: "16px 18px" }}>
                <div
                  style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}
                >
                  Qualidade da coleta
                </div>
                {[
                  ["Campos preenchidos (média)", `${l.avgFillPct}%`],
                  ["Leads em coleta", l.inProgress],
                  ["Leads fechados", l.closed],
                  ["Fechados hoje", l.today],
                ].map(([title, value]) => (
                  <div
                    key={title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 0",
                      borderTop: "1px solid var(--bd)",
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 13 }}>{title}</span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* a tabela é a leitura alternativa dos mesmos dados */}
            <div style={{ ...card, overflow: "hidden" }}>
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid var(--bd)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                    Últimos leads fechados
                  </div>
                  <div style={{ ...label, marginTop: 3 }}>
                    Campos coletados pela IA, na ordem que você configurou.
                  </div>
                </div>
                {onGoInbox && (
                  <Hover
                    onClick={onGoInbox}
                    style={{ ...btnGhost(30, 12), background: "transparent" }}
                    hoverStyle={HOVER_MUTED}
                  >
                    Abrir conversas
                  </Hover>
                )}
              </div>

              {data.recentLeads.length === 0 ? (
                <div style={{ padding: "22px 18px", ...label }}>
                  Nenhum lead fechado ainda. Confira os campos obrigatórios em
                  Comportamento da IA → Coleta e leads.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          "Telefone",
                          ...leadColumns.map(
                            (k) => data.recentLeads[0].labels?.[k] || k,
                          ),
                          "Fechado",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "10px 18px",
                              ...label,
                              fontWeight: 500,
                              borderBottom: "1px solid var(--bd)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentLeads.map((lead) => (
                        <tr key={lead.phoneNumber}>
                          <td
                            style={{
                              padding: "11px 18px",
                              borderBottom: "1px solid var(--bd)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatPhone(lead.phoneNumber)}
                          </td>
                          {leadColumns.map((k) => (
                            <td
                              key={k}
                              style={{
                                padding: "11px 18px",
                                borderBottom: "1px solid var(--bd)",
                              }}
                            >
                              {lead.fields?.[k] || (
                                <span style={{ color: "var(--mfg)" }}>—</span>
                              )}
                            </td>
                          ))}
                          <td
                            style={{
                              padding: "11px 18px",
                              borderBottom: "1px solid var(--bd)",
                              color: "var(--mfg)",
                              fontFamily: MONO,
                              fontSize: 12,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dayLabel(String(lead.closedAt).slice(0, 10))}{" "}
                            {clockTime(lead.closedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ ...label, fontSize: 11.5 }}>
              Atualizado em {clockTime(data.generatedAt)}. “Resolvidas pela IA”
              conta conversas que nunca precisaram de humano nem foram assumidas
              por um.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
