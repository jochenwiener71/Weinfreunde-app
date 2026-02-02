"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Criterion = { id: string; label: string; order: number; scaleMin: number; scaleMax: number };
type Row = {
  wineId: string;
  blindNumber: number | null;
  isActive: boolean;
  displayName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;
  nRatings: number;
  overallAvg: number | null;
  perCriteriaAvg: Record<string, number | null>;
};

type ApiResp = {
  ok: true;
  publicSlug: string;
  tasting: { id: string; title: string | null; hostName: string | null; status: string | null; wineCount: number | null };
  criteria: Criterion[];
  rows: Row[];
  ratingCount: number;
};

function encode(s: string) {
  return encodeURIComponent(s);
}

function wineTitle(r: Row) {
  const parts = [r.winery, r.displayName, r.grape, r.vintage].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return `Wein #${r.blindNumber ?? "?"}`;
}

function scoreText(v: number | null) {
  if (v === null || typeof v !== "number") return "—";
  return v.toFixed(2);
}

function emojiRank(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "🏅";
}

export default function AdminReportingPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [data, setData] = useState<ApiResp | null>(null);
  const [expandedWineId, setExpandedWineId] = useState<string | null>(null);

  // Restore secret
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("WF_ADMIN_SECRET") : null;
    if (saved) setAdminSecret(saved);
  }, []);

  useEffect(() => {
    if (adminSecret.trim()) window.localStorage.setItem("WF_ADMIN_SECRET", adminSecret.trim());
  }, [adminSecret]);

  const canLoad = useMemo(
    () => adminSecret.trim().length > 0 && publicSlug.trim().length > 0,
    [adminSecret, publicSlug]
  );

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/report-live?publicSlug=${encode(publicSlug.trim())}`, {
        method: "GET",
        headers: { "x-admin-secret": adminSecret.trim() },
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setData(json as ApiResp);
      setMsg("Live-Ranking geladen ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Top-3 (nur Weine mit Score)
  const top3 = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((r) => typeof r.overallAvg === "number").slice(0, 3);
  }, [data]);

  return (
    <div style={pageStyle}>
      {/* background like join */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/join-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(3px)",
          transform: "scale(1.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.82) 60%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      <main style={wrapStyle}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>📊 Admin · Live-Ranking</h1>
              <p style={{ margin: "6px 0 0 0", opacity: 0.8, fontSize: 13 }}>
                Durchschnitt je Wein (aus allen Teilnehmer-Ratings). Sortiert nach Score.
              </p>
            </div>
            <Link href="/admin" style={topLinkStyle}>
              ← Dashboard
            </Link>
          </div>

          {/* Controls */}
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <label style={labelStyle}>
              ADMIN_SECRET
              <input
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="dein ADMIN_SECRET aus Vercel"
                style={inputStyle}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>

            <label style={labelStyle}>
              publicSlug
              <input
                value={publicSlug}
                onChange={(e) => setPublicSlug(e.target.value)}
                placeholder="weinfreunde-feb26"
                style={inputStyle}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={load} disabled={!canLoad || loading} style={buttonStyle}>
                {loading ? "Lade…" : "Live-Ranking laden"}
              </button>

              {data?.publicSlug ? (
                <a
                  href={`/join?slug=${encode(data.publicSlug)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={ghostButtonStyle}
                >
                  Join öffnen
                </a>
              ) : (
                <span style={{ opacity: 0.5, fontSize: 12, alignSelf: "center" }}>
                  Join-Link erscheint nach Laden.
                </span>
              )}

              {/* Quick reload */}
              {data ? (
                <button onClick={load} disabled={loading} style={ghostBtn2}>
                  ↻ Aktualisieren
                </button>
              ) : null}
            </div>

            {msg && <p style={{ margin: 0, color: msg.includes("✅") ? "white" : "#ffb4b4" }}>{msg}</p>}
          </div>

          {data && (
            <>
              <hr style={{ margin: "18px 0", opacity: 0.2 }} />

              {/* Header line */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ opacity: 0.85, fontSize: 13 }}>
                  <strong>{data.tasting.title ?? "(ohne Titel)"}</strong> · {data.tasting.hostName ?? "-"} · Status:{" "}
                  <code style={codeStyle}>{data.tasting.status ?? "-"}</code>
                </div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  Ratings gesamt: <strong>{data.ratingCount}</strong>
                </div>
              </div>

              {/* TOP 3 PODIUM */}
              <section style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 16 }}>🏆 Top 3</h2>
                  <div style={{ opacity: 0.65, fontSize: 12 }}>
                    {top3.length ? "Live aus aktuellen Ratings" : "Noch keine Bewertungen"}
                  </div>
                </div>

                {!top3.length ? (
                  <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
                    Sobald erste Bewertungen gespeichert sind, erscheint hier automatisch das Podium.
                  </div>
                ) : (
                  <div style={podiumGrid}>
                    {top3.map((r, idx) => (
                      <div key={r.wineId} style={{ ...podiumCard, ...(idx === 0 ? podiumCardWinner : {}) }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 900 }}>
                              {emojiRank(idx)} Platz {idx + 1}
                            </div>
                            <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>
                              <strong>{r.blindNumber ? `Wein #${r.blindNumber}` : "Wein"}</strong>
                              {!r.isActive ? <span style={{ marginLeft: 8, opacity: 0.6 }}>(inaktiv)</span> : null}
                            </div>
                            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>{wineTitle(r)}</div>
                            <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
                              Ratings: <strong>{r.nRatings}</strong>
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>Ø Score</div>
                            <div style={bigScoreBadge}>{scoreText(r.overallAvg)}</div>
                            {r.blindNumber ? (
                              <a
                                href={`/t/${encode(data.publicSlug)}/wine/${r.blindNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                style={podiumLink}
                              >
                                Bewertung öffnen ↗
                              </a>
                            ) : null}
                          </div>
                        </div>

                        {/* mini criteria line (top only) */}
                        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {data.criteria
                            .slice()
                            .sort((a, b) => a.order - b.order)
                            .slice(0, 3)
                            .map((c) => {
                              const v = r.perCriteriaAvg?.[c.id] ?? null;
                              return (
                                <div key={c.id} style={pill}>
                                  <span style={{ opacity: 0.8 }}>{c.label}</span>
                                  <span style={{ fontWeight: 900, marginLeft: 8 }}>
                                    {v === null ? "—" : v.toFixed(1)}
                                  </span>
                                </div>
                              );
                            })}
                          {data.criteria.length > 3 ? (
                            <div style={{ ...pill, opacity: 0.75 }}>+{data.criteria.length - 3} Kriterien</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* TABLE */}
              <div style={{ overflowX: "auto", marginTop: 18 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", opacity: 0.9 }}>
                      <th style={th}>#</th>
                      <th style={th}>Wein</th>
                      <th style={thRight}>Ø Score</th>
                      <th style={thRight}>Ratings</th>
                      <th style={th}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, idx) => {
                      const isOpen = expandedWineId === r.wineId;
                      return (
                        <>
                          <tr key={r.wineId} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                            <td style={td}>{idx + 1}</td>

                            <td style={td}>
                              <div style={{ fontWeight: 900, display: "flex", gap: 10, alignItems: "center" }}>
                                <span>{r.blindNumber ? `Wein #${r.blindNumber}` : "Wein"}</span>
                                {!r.isActive ? <span style={{ opacity: 0.6, fontSize: 12 }}>(inaktiv)</span> : null}
                              </div>
                              <div style={{ opacity: 0.85, fontSize: 13 }}>{wineTitle(r)}</div>
                            </td>

                            <td style={tdRight}>
                              <span style={{ ...scoreBadge, opacity: r.overallAvg === null ? 0.55 : 1 }}>
                                {scoreText(r.overallAvg)}
                              </span>
                            </td>

                            <td style={tdRight}>{r.nRatings}</td>

                            <td style={td}>
                              <button
                                onClick={() => setExpandedWineId(isOpen ? null : r.wineId)}
                                style={{ ...smallBtn, opacity: 0.95 }}
                              >
                                {isOpen ? "Details schließen" : "Details"}
                              </button>

                              {r.blindNumber ? (
                                <a
                                  href={`/t/${encode(data.publicSlug)}/wine/${r.blindNumber}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ ...smallLink, marginLeft: 10 }}
                                >
                                  Bewertung öffnen ↗
                                </a>
                              ) : null}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr key={`${r.wineId}-details`}>
                              <td style={{ ...td, paddingTop: 0 }} />
                              <td colSpan={4} style={{ ...td, paddingTop: 0 }}>
                                <div style={detailBox}>
                                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Ø je Kriterium</div>
                                  <div style={{ display: "grid", gap: 8 }}>
                                    {data.criteria
                                      .slice()
                                      .sort((a, b) => a.order - b.order)
                                      .map((c) => {
                                        const v = r.perCriteriaAvg?.[c.id] ?? null;
                                        return (
                                          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                            <div style={{ opacity: 0.9 }}>{c.label}</div>
                                            <div style={{ fontVariantNumeric: "tabular-nums" }}>
                                              {v === null ? (
                                                <span style={{ opacity: 0.6 }}>—</span>
                                              ) : (
                                                <strong>{v.toFixed(2)}</strong>
                                              )}
                                              <span style={{ opacity: 0.55, marginLeft: 8 }}>
                                                ({c.scaleMin}–{c.scaleMax})
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
                Hinweis: Ø Score ist der Durchschnitt aus den pro-Rating Mittelwerten (über alle abgegebenen Kriterien).
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* styles */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
};

const wrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 980,
  background: "rgba(20,20,20,0.75)",
  backdropFilter: "blur(6px)",
  borderRadius: 16,
  padding: 22,
  boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
  color: "white",
};

const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, opacity: 0.95 };

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  outline: "none",
  fontSize: 16,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  color: "white",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  textDecoration: "none",
  color: "white",
  fontWeight: 800,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  display: "inline-block",
};

const ghostBtn2: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const topLinkStyle: React.CSSProperties = {
  color: "white",
  textDecoration: "none",
  opacity: 0.85,
  fontSize: 13,
  border: "1px solid rgba(255,255,255,0.18)",
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.08)",
};

const codeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  padding: "2px 6px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.14)",
};

const th: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.16)",
  fontSize: 12,
  letterSpacing: 0.2,
};

const thRight: React.CSSProperties = { ...th, textAlign: "right" };

const td: React.CSSProperties = {
  padding: "12px 10px",
  verticalAlign: "top",
  fontSize: 14,
};

const tdRight: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

const smallBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const smallLink: React.CSSProperties = { color: "white", opacity: 0.9, textDecoration: "underline", fontWeight: 800 };

const detailBox: React.CSSProperties = {
  marginTop: 6,
  padding: 12,
  borderRadius: 12,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
};

/* NEW: Top-3 + Score badges */
const podiumGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 12,
};

const podiumCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const podiumCardWinner: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.22)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
};

const bigScoreBadge: React.CSSProperties = {
  marginTop: 6,
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 950,
  fontSize: 22,
  letterSpacing: 0.3,
  fontVariantNumeric: "tabular-nums",
};

const podiumLink: React.CSSProperties = {
  display: "inline-block",
  marginTop: 10,
  color: "white",
  opacity: 0.9,
  textDecoration: "underline",
  fontWeight: 800,
  fontSize: 12,
};

const pill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  display: "inline-flex",
  gap: 6,
};

const scoreBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.10)",
  fontWeight: 950,
  minWidth: 70,
  textAlign: "right",
};
