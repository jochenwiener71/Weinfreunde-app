"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Criterion = { id: string; label: string; order: number; scaleMin: number; scaleMax: number };

type Row = {
  wineId: string;
  blindNumber: number | null;
  isActive: boolean;
  displayName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;
  ownerName?: string | null;
  imageUrl?: string | null;
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

function enc(s: string) {
  return encodeURIComponent(s);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function scoreText(v: number | null) {
  if (v == null) return "—";
  return v.toFixed(2);
}

function scoreColor(t: number) {
  const tt = clamp(t, 0, 1);
  const hue = 8 + (48 - 8) * tt;
  return `hsl(${hue} 90% 55%)`;
}

function scoreBg(t: number) {
  const tt = clamp(t, 0, 1);
  const hue = 8 + (48 - 8) * tt;
  return `hsl(${hue} 80% 18%)`;
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

  const lastPosRef = useRef<Record<string, number>>({}); // wineId -> index

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
      const res = await fetch(`/api/admin/report-live?publicSlug=${enc(publicSlug.trim())}`, {
        method: "GET",
        headers: { "x-admin-secret": adminSecret.trim() },
        cache: "no-store",
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

  // Sort rows by overall desc (nulls last)
  const sortedRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows
      .slice()
      .sort((a, b) => {
        if (a.overallAvg == null && b.overallAvg == null) return (a.blindNumber ?? 999) - (b.blindNumber ?? 999);
        if (a.overallAvg == null) return 1;
        if (b.overallAvg == null) return -1;
        if (b.overallAvg !== a.overallAvg) return b.overallAvg - a.overallAvg;
        return (a.blindNumber ?? 999) - (b.blindNumber ?? 999);
      });
  }, [data]);

  const orderedCriteria = useMemo(() => {
    return (data?.criteria ?? []).slice().sort((a, b) => a.order - b.order);
  }, [data]);

  // rank delta (▲▼ NEW) by wineId
  const rankDelta = useMemo(() => {
    const nowPos: Record<string, number> = {};
    sortedRows.forEach((r, idx) => {
      nowPos[r.wineId] = idx;
    });

    const prevPos = lastPosRef.current;
    const delta: Record<string, { kind: "up" | "down" | "same" | "new"; by: number }> = {};

    for (const r of sortedRows) {
      const now = nowPos[r.wineId];
      const prev = prevPos[r.wineId];

      if (typeof prev !== "number") delta[r.wineId] = { kind: "new", by: 0 };
      else if (prev === now) delta[r.wineId] = { kind: "same", by: 0 };
      else if (now < prev) delta[r.wineId] = { kind: "up", by: prev - now };
      else delta[r.wineId] = { kind: "down", by: now - prev };
    }

    lastPosRef.current = nowPos;
    return delta;
  }, [sortedRows]);

  const top3 = useMemo(() => {
    return sortedRows.filter((r) => typeof r.overallAvg === "number").slice(0, 3);
  }, [sortedRows]);

  // use criteria scale if present, else default 1..10
  const scaleMin = useMemo(() => {
    const c = orderedCriteria[0];
    return typeof c?.scaleMin === "number" ? c.scaleMin : 1;
  }, [orderedCriteria]);

  const scaleMax = useMemo(() => {
    const c = orderedCriteria[0];
    return typeof c?.scaleMax === "number" ? c.scaleMax : 10;
  }, [orderedCriteria]);

  function norm(v: number | null) {
    if (v == null) return 0;
    return clamp((v - scaleMin) / (scaleMax - scaleMin), 0, 1);
  }

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
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>📊 Admin · Live-Ranking</h1>
              <p style={{ margin: "6px 0 0 0", opacity: 0.8, fontSize: 13 }}>
                Premium Dashboard: Podium · Score-Bars · Rank-Δ · Details.
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
                <>
                  <a href={`/reporting/${enc(data.publicSlug)}`} target="_blank" rel="noreferrer" style={ghostButtonStyle}>
                    Public Reporting öffnen ↗
                  </a>
                  <a href={`/join?slug=${enc(data.publicSlug)}`} target="_blank" rel="noreferrer" style={ghostButtonStyle}>
                    Join öffnen ↗
                  </a>
                </>
              ) : (
                <span style={{ opacity: 0.5, fontSize: 12, alignSelf: "center" }}>
                  Links erscheinen nach Laden.
                </span>
              )}

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

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ opacity: 0.85, fontSize: 13 }}>
                  <strong>{data.tasting.title ?? "(ohne Titel)"}</strong> · {data.tasting.hostName ?? "-"} · Status:{" "}
                  <code style={codeStyle}>{data.tasting.status ?? "-"}</code>
                </div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  Ratings gesamt: <strong>{data.ratingCount}</strong> · Skala: {scaleMin}–{scaleMax}
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
                    {top3.map((r, idx) => {
                      const t = norm(r.overallAvg);
                      const col = scoreColor(t);
                      const bg = scoreBg(t);

                      return (
                        <div
                          key={r.wineId}
                          style={{ ...podiumCard, ...(idx === 0 ? podiumCardWinner : {}) }}
                          className="wf-pop"
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 950 }}>
                                {emojiRank(idx)} Platz {idx + 1}
                              </div>
                              <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>
                                <strong>{r.blindNumber ? `Wein #${r.blindNumber}` : "Wein"}</strong>
                                {!r.isActive ? <span style={{ marginLeft: 8, opacity: 0.6 }}>(inaktiv)</span> : null}
                              </div>
                              <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>
                                <b>{r.winery ?? "—"}</b>
                                {r.grape ? ` · ${r.grape}` : ""}
                                {r.vintage ? ` · ${r.vintage}` : ""}
                              </div>
                              <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
                                Ratings: <strong>{r.nRatings}</strong>
                              </div>
                            </div>

                            <div style={{ textAlign: "right", minWidth: 120 }}>
                              <div style={{ opacity: 0.7, fontSize: 12 }}>Ø Score</div>
                              <div style={{ ...bigScoreBadge, background: bg }}>
                                <span style={{ color: col }}>{scoreText(r.overallAvg)}</span>
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <div style={barWrap}>
                                  <div
                                    style={{
                                      ...barFill,
                                      width: `${Math.round(t * 100)}%`,
                                      background: `linear-gradient(90deg, ${scoreColor(0)} 0%, ${col} 65%, hsl(48 95% 60%) 100%)`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {orderedCriteria.slice(0, 4).map((c) => {
                              const v = r.perCriteriaAvg?.[c.id] ?? null;
                              return (
                                <div key={c.id} style={pill}>
                                  <span style={{ opacity: 0.8 }}>{c.label}</span>
                                  <span style={{ fontWeight: 950, marginLeft: 8 }}>
                                    {v === null ? "—" : v.toFixed(1)}
                                  </span>
                                </div>
                              );
                            })}
                            {orderedCriteria.length > 4 ? (
                              <div style={{ ...pill, opacity: 0.75 }}>+{orderedCriteria.length - 4} Kriterien</div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
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
                      <th style={{ ...th, textAlign: "right" }}>Δ</th>
                      <th style={{ ...th, textAlign: "right" }}>Ø Score</th>
                      <th style={th}>Score</th>
                      <th style={{ ...th, textAlign: "right" }}>Ratings</th>
                      <th style={th}>Aktion</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedRows.map((r, idx) => {
                      const isOpen = expandedWineId === r.wineId;
                      const t = norm(r.overallAvg);
                      const d = rankDelta[r.wineId] ?? { kind: "new", by: 0 };

                      const deltaNode =
                        d.kind === "new" ? (
                          <span style={{ ...deltaPill, background: "rgba(255,255,255,0.12)" }}>NEW</span>
                        ) : d.kind === "same" ? (
                          <span style={{ ...deltaPill, opacity: 0.65 }}>—</span>
                        ) : d.kind === "up" ? (
                          <span style={{ ...deltaPill, background: "rgba(80,200,120,0.16)", borderColor: "rgba(80,200,120,0.25)" }}>
                            ▲ {d.by}
                          </span>
                        ) : (
                          <span style={{ ...deltaPill, background: "rgba(255,120,120,0.16)", borderColor: "rgba(255,120,120,0.25)" }}>
                            ▼ {d.by}
                          </span>
                        );

                      return (
                        <>
                          <tr key={r.wineId} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }} className="wf-fade">
                            <td style={td}>{idx + 1}</td>

                            <td style={td}>
                              <div style={{ fontWeight: 950, display: "flex", gap: 10, alignItems: "center" }}>
                                <span>{r.blindNumber ? `Wein #${r.blindNumber}` : "Wein"}</span>
                                {!r.isActive ? <span style={{ opacity: 0.6, fontSize: 12 }}>(inaktiv)</span> : null}
                              </div>
                              <div style={{ opacity: 0.85, fontSize: 13 }}>
                                <b>{r.winery ?? "—"}</b>
                                {r.grape ? ` · ${r.grape}` : ""}
                                {r.vintage ? ` · ${r.vintage}` : ""}
                              </div>
                            </td>

                            <td style={tdRight}>{deltaNode}</td>

                            <td style={tdRight}>
                              <span style={{ ...scoreBadge, opacity: r.overallAvg === null ? 0.55 : 1 }}>
                                {scoreText(r.overallAvg)}
                              </span>
                            </td>

                            <td style={td}>
                              <div style={barWrap}>
                                <div
                                  style={{
                                    ...barFill,
                                    width: `${Math.round(t * 100)}%`,
                                    background: `linear-gradient(90deg, ${scoreColor(0)} 0%, ${scoreColor(t)} 65%, hsl(48 95% 60%) 100%)`,
                                  }}
                                />
                              </div>
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
                                  href={`/t/${enc(data.publicSlug)}/wine/${r.blindNumber}`}
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
                              <td colSpan={6} style={{ ...td, paddingTop: 0 }}>
                                <div style={detailBox}>
                                  <div style={{ fontWeight: 950, marginBottom: 10 }}>Ø je Kriterium</div>
                                  <div style={{ display: "grid", gap: 8 }}>
                                    {orderedCriteria.map((c) => {
                                      const v = r.perCriteriaAvg?.[c.id] ?? null;
                                      const tt = v == null ? 0 : clamp((v - c.scaleMin) / (c.scaleMax - c.scaleMin), 0, 1);
                                      return (
                                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                          <div style={{ opacity: 0.9 }}>{c.label}</div>
                                          <div style={{ fontVariantNumeric: "tabular-nums" }}>
                                            <span style={{ fontWeight: 950, color: v == null ? "rgba(255,255,255,0.65)" : scoreColor(tt) }}>
                                              {v === null ? "—" : v.toFixed(2)}
                                            </span>
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

      <style jsx global>{`
        .wf-pop {
          animation: wfPop 420ms ease-out both;
        }
        .wf-fade {
          animation: wfFade 360ms ease-out both;
        }
        @keyframes wfPop {
          from {
            transform: translateY(6px) scale(0.99);
            opacity: 0.0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes wfFade {
          from {
            opacity: 0.0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
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
  maxWidth: 1050,
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
  fontWeight: 950,
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  textDecoration: "none",
  color: "white",
  fontWeight: 900,
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
  fontWeight: 900,
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
  fontWeight: 900,
};

const smallLink: React.CSSProperties = {
  color: "white",
  opacity: 0.9,
  textDecoration: "underline",
  fontWeight: 900,
};

const detailBox: React.CSSProperties = {
  marginTop: 6,
  padding: 12,
  borderRadius: 12,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
};

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
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 950,
  fontSize: 22,
  letterSpacing: 0.3,
  fontVariantNumeric: "tabular-nums",
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
  fontVariantNumeric: "tabular-nums",
};

const barWrap: React.CSSProperties = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  overflow: "hidden",
};

const barFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 420ms ease",
};

const deltaPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 56,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  fontWeight: 950,
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};
