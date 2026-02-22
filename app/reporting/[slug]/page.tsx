"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SummaryRow = {
  blindNumber: number;
  perCrit: Record<string, number | null>;
  overall: number | null;
};

type SummaryResponse = {
  ok: true;
  publicSlug: string;
  tastingId: string;
  status: string | null;
  wineCount: number;
  criteria: { id: string; label: string; order: number }[];
  rows: SummaryRow[];
  ranking: SummaryRow[];
  ratingCount: number;
};

type WineSlotPublic = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
};

type WinesResponse = {
  ok: true;
  publicSlug: string;
  tastingId: string;
  status: string;
  wineCount: number;
  wines: WineSlotPublic[];
};

function enc(s: string) {
  return encodeURIComponent(s);
}

// --- visual helpers (no dependencies) ---
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Color scale: low -> red, high -> gold
 * We map t∈[0..1] to HSL hue ~ 8° (red) -> 48° (gold)
 */
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

function scoreText(v: number | null, digits = 2) {
  if (v == null) return "—";
  return v.toFixed(digits);
}

function emojiRank(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "🏅";
}

function getTvModeFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  const u = new URL(window.location.href);
  return u.searchParams.get("tv") === "1";
}

function setTvModeInUrl(tv: boolean) {
  const u = new URL(window.location.href);
  if (tv) u.searchParams.set("tv", "1");
  else u.searchParams.delete("tv");
  window.history.replaceState({}, "", u.toString());
}

export default function ReportingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug || "");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [tvMode, setTvMode] = useState(false);

  // Remember last ranking positions to show ▲▼
  const lastPosRef = useRef<Record<number, number>>({}); // blindNumber -> index

  // Auto-refresh interval (10s is ok for public)
  const REFRESH_MS = 10_000;

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      const [sRes, wRes] = await Promise.all([
        fetch(`/api/tasting/summary?publicSlug=${enc(slug)}`, { cache: "no-store" }),
        fetch(`/api/tasting/wines?publicSlug=${enc(slug)}`, { cache: "no-store" }),
      ]);

      const sText = await sRes.text();
      const wText = await wRes.text();

      const sJson = sText ? JSON.parse(sText) : {};
      const wJson = wText ? JSON.parse(wText) : {};

      if (!sRes.ok) throw new Error(sJson?.error ?? `Summary HTTP ${sRes.status}`);
      if (!wRes.ok) throw new Error(wJson?.error ?? `Wines HTTP ${wRes.status}`);

      setSummary(sJson);
      setWines(wJson);
    } catch (e: any) {
      setMsg(e?.message ?? "Load failed");
      setSummary(null);
      setWines(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // init TV from URL
    const tv = getTvModeFromUrl();
    setTvMode(tv);

    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function toggleTv() {
    setTvMode((v) => {
      const next = !v;
      setTvModeInUrl(next);
      return next;
    });
  }

  const orderedCriteria = useMemo(() => {
    return (summary?.criteria ?? []).slice().sort((a, b) => a.order - b.order);
  }, [summary]);

  const wineByBlind = useMemo(() => {
    const map = new Map<number, WineSlotPublic>();
    for (const w of wines?.wines ?? []) {
      if (typeof w.blindNumber === "number") map.set(w.blindNumber, w);
    }
    return map;
  }, [wines]);

  // Ranking rows: use summary.ranking if present, else rows
  const ranking = useMemo(() => {
    const rows = (summary?.ranking?.length ? summary.ranking : summary?.rows ?? []).slice();

    // Sort by overall desc, nulls last, tie-breaker by blindNumber asc
    rows.sort((a, b) => {
      if (a.overall == null && b.overall == null) return a.blindNumber - b.blindNumber;
      if (a.overall == null) return 1;
      if (b.overall == null) return -1;
      if (b.overall !== a.overall) return b.overall - a.overall;
      return a.blindNumber - b.blindNumber;
    });

    return rows;
  }, [summary]);

  // Determine min/max for bar normalization.
  // If criteria scale not provided in summary, we assume 1..10 (fits your sliders).
  const scaleMin = 1;
  const scaleMax = 10;

  function norm(v: number | null) {
    if (v == null) return 0;
    return clamp((v - scaleMin) / (scaleMax - scaleMin), 0, 1);
  }

  // Rank delta indicator (▲▼ NEW)
  const rankDelta = useMemo(() => {
    const nowPos: Record<number, number> = {};
    ranking.forEach((r, idx) => {
      nowPos[r.blindNumber] = idx;
    });

    const prevPos = lastPosRef.current;
    const delta: Record<number, { kind: "up" | "down" | "same" | "new"; by: number }> = {};

    for (const r of ranking) {
      const bn = r.blindNumber;
      const now = nowPos[bn];
      const prev = prevPos[bn];

      if (typeof prev !== "number") {
        delta[bn] = { kind: "new", by: 0 };
      } else if (prev === now) {
        delta[bn] = { kind: "same", by: 0 };
      } else if (now < prev) {
        delta[bn] = { kind: "up", by: prev - now };
      } else {
        delta[bn] = { kind: "down", by: now - prev };
      }
    }

    // update ref (after computing)
    lastPosRef.current = nowPos;

    return delta;
  }, [ranking]);

  const top3 = useMemo(() => ranking.slice(0, 3), [ranking]);

  const headerTitle = useMemo(() => {
    // we don't have title in public summary; keep slug
    return `Runde: ${slug}`;
  }, [slug]);

  return (
    <div style={{ ...pageStyle, ...(tvMode ? pageStyleTv : {}) }}>
      {/* Premium background like Join */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/join-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: tvMode ? "blur(3px)" : "blur(2px)",
          transform: "scale(1.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.78) 60%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      <main style={{ ...wrapStyle, ...(tvMode ? wrapStyleTv : {}) }}>
        {/* Header */}
        <header style={{ ...headerStyle, ...(tvMode ? headerStyleTv : {}) }}>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: tvMode ? 34 : 26 }}>
                🍷 Reporting
              </h1>
              <span style={{ opacity: 0.8, fontSize: tvMode ? 16 : 13 }}>
                <code style={codeStyle}>{slug}</code>
              </span>
            </div>
            <p style={{ margin: "6px 0 0 0", opacity: 0.8, fontSize: tvMode ? 14 : 12 }}>
              {headerTitle} · Status: <b>{summary?.status ?? "—"}</b> · Ratings:{" "}
              <b>{summary?.ratingCount ?? 0}</b> · Auto-Refresh: {Math.round(REFRESH_MS / 1000)}s
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {!tvMode && (
              <a
                href={`/join?slug=${enc(slug)}`}
                target="_blank"
                rel="noreferrer"
                style={ghostLinkStyle}
              >
                Join ↗
              </a>
            )}

            <button onClick={load} style={ghostBtnStyle}>
              ↻ Refresh
            </button>

            <button onClick={toggleTv} style={ghostBtnStyle}>
              {tvMode ? "TV-Mode aus" : "TV-Mode an"}
            </button>
          </div>
        </header>

        {msg && <div style={errorStyle}>{msg}</div>}

        {loading && !summary && (
          <section style={cardStyle}>
            <div style={{ opacity: 0.85 }}>Lade…</div>
          </section>
        )}

        {!summary && !loading && (
          <section style={cardStyle}>
            <div style={{ opacity: 0.85 }}>Keine Daten.</div>
          </section>
        )}

        {summary && (
          <>
            {/* Top 3 Podium */}
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: tvMode ? 18 : 16 }}>🏆 Top 3</h2>
                <div style={{ opacity: 0.7, fontSize: tvMode ? 13 : 12 }}>
                  Live aus aktuellen Ratings
                </div>
              </div>

              {!top3.length ? (
                <div style={{ marginTop: 10, opacity: 0.8 }}>
                  Noch keine Auswertung verfügbar.
                </div>
              ) : (
                <div style={{ ...podiumGrid, ...(tvMode ? podiumGridTv : {}) }}>
                  {top3.map((r, idx) => {
                    const w = wineByBlind.get(r.blindNumber);
                    const t = norm(r.overall);
                    const c = scoreColor(t);
                    const bg = scoreBg(t);

                    return (
                      <div
                        key={r.blindNumber}
                        style={{
                          ...podiumCard,
                          ...(idx === 0 ? podiumWinner : {}),
                          borderColor: `rgba(255,255,255,${idx === 0 ? 0.22 : 0.14})`,
                        }}
                        className="wf-pop"
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 950, fontSize: tvMode ? 18 : 14 }}>
                              {emojiRank(idx)} Platz {idx + 1}
                            </div>
                            <div style={{ marginTop: 6, opacity: 0.9, fontSize: tvMode ? 14 : 13 }}>
                              <strong>Wein #{r.blindNumber}</strong>{" "}
                              {w?.ownerName ? (
                                <span style={{ opacity: 0.75 }}>· {w.ownerName}</span>
                              ) : null}
                            </div>
                            <div style={{ marginTop: 6, opacity: 0.9, fontSize: tvMode ? 14 : 13 }}>
                              <b>{w?.winery ?? "—"}</b>
                              {w?.grape ? ` · ${w.grape}` : ""}
                              {w?.vintage ? ` · ${w.vintage}` : ""}
                            </div>
                          </div>

                          <div style={{ textAlign: "right", minWidth: tvMode ? 120 : 100 }}>
                            <div style={{ opacity: 0.75, fontSize: tvMode ? 13 : 12 }}>Ø Score</div>

                            <div
                              style={{
                                ...bigScore,
                                background: bg,
                                borderColor: "rgba(255,255,255,0.18)",
                              }}
                            >
                              <span style={{ color: c }}>{scoreText(r.overall, 2)}</span>
                            </div>

                            <div style={{ marginTop: 10 }}>
                              <div style={barWrap}>
                                <div
                                  style={{
                                    ...barFill,
                                    width: `${Math.round(t * 100)}%`,
                                    background: `linear-gradient(90deg, ${scoreColor(0)} 0%, ${c} 60%, hsl(48 95% 60%) 100%)`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Mini criteria pills */}
                        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {orderedCriteria.slice(0, 4).map((c0) => {
                            const v = safeNum(r.perCrit?.[c0.id]);
                            return (
                              <span key={c0.id} style={pillStyle}>
                                <span style={{ opacity: 0.8 }}>{c0.label}</span>
                                <span style={{ fontWeight: 950, marginLeft: 8 }}>
                                  {v == null ? "—" : v.toFixed(1)}
                                </span>
                              </span>
                            );
                          })}
                          {orderedCriteria.length > 4 ? (
                            <span style={{ ...pillStyle, opacity: 0.75 }}>
                              +{orderedCriteria.length - 4} Kriterien
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Ranking Table + Rank delta */}
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: tvMode ? 18 : 16 }}>📊 Ranking</h2>
                <div style={{ opacity: 0.7, fontSize: tvMode ? 13 : 12 }}>
                  Score-Bar: {scaleMin}–{scaleMax}
                </div>
              </div>

              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: tvMode ? 980 : 860 }}>
                  <thead>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>Wein</th>
                      <th style={{ ...th, textAlign: "right" }}>Δ</th>
                      <th style={{ ...th, textAlign: "right" }}>Ø</th>
                      <th style={th}>Score</th>
                      {!tvMode &&
                        orderedCriteria.map((c) => (
                          <th key={c.id} style={{ ...th, textAlign: "right" }}>
                            {c.label}
                          </th>
                        ))}
                      <th style={th}>Owner</th>
                    </tr>
                  </thead>

                  <tbody>
                    {ranking.map((r, i) => {
                      const w = wineByBlind.get(r.blindNumber);
                      const t = norm(r.overall);
                      const delta = rankDelta[r.blindNumber] ?? { kind: "new", by: 0 };

                      const deltaNode =
                        delta.kind === "new" ? (
                          <span style={{ ...deltaPill, background: "rgba(255,255,255,0.12)" }}>NEW</span>
                        ) : delta.kind === "same" ? (
                          <span style={{ ...deltaPill, opacity: 0.65 }}>—</span>
                        ) : delta.kind === "up" ? (
                          <span style={{ ...deltaPill, background: "rgba(80,200,120,0.16)", borderColor: "rgba(80,200,120,0.25)" }}>
                            ▲ {delta.by}
                          </span>
                        ) : (
                          <span style={{ ...deltaPill, background: "rgba(255,120,120,0.16)", borderColor: "rgba(255,120,120,0.25)" }}>
                            ▼ {delta.by}
                          </span>
                        );

                      return (
                        <tr key={r.blindNumber} className="wf-fade">
                          <td style={td}>{i + 1}</td>

                          <td style={td}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              {w?.imageUrl ? (
                                <img
                                  src={w.imageUrl}
                                  alt="Flasche"
                                  style={{
                                    width: tvMode ? 56 : 44,
                                    height: tvMode ? 80 : 64,
                                    objectFit: "cover",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.16)",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: tvMode ? 56 : 44,
                                    height: tvMode ? 80 : 64,
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.16)",
                                    background: "rgba(255,255,255,0.06)",
                                  }}
                                />
                              )}

                              <div>
                                <div style={{ fontWeight: 950 }}>
                                  Wein #{r.blindNumber}{" "}
                                  {!w?.winery && !w?.grape && !w?.vintage ? (
                                    <span style={{ opacity: 0.65, fontWeight: 700 }}>(blind)</span>
                                  ) : null}
                                </div>
                                <div style={{ opacity: 0.85, fontSize: tvMode ? 14 : 13 }}>
                                  <b>{w?.winery ?? "—"}</b>
                                  {w?.grape ? ` · ${w.grape}` : ""}
                                  {w?.vintage ? ` · ${w.vintage}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ ...tdRight, width: 90 }}>{deltaNode}</td>

                          <td style={{ ...tdRight, width: 90, fontWeight: 950 }}>
                            {scoreText(r.overall, 2)}
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

                          {!tvMode &&
                            orderedCriteria.map((c) => {
                              const v = safeNum(r.perCrit?.[c.id]);
                              return (
                                <td key={c.id} style={tdRight}>
                                  {v == null ? "—" : v.toFixed(2)}
                                </td>
                              );
                            })}

                          <td style={td}>
                            <span style={{ opacity: 0.9 }}>{w?.ownerName ?? "—"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ marginTop: 12, opacity: 0.7, fontSize: tvMode ? 12 : 12 }}>
                Hinweis: Ø = Durchschnitt über Kriterien (je Wein). Bei <b>TV-Mode</b> werden die Kriterien-Spalten ausgeblendet.
              </p>
            </section>

            {/* Heatmap: Wine x Criteria */}
            {!tvMode && (
              <section style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 16 }}>🌡️ Heatmap · Kriterien</h2>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Wein × Kriterium</div>
                </div>

                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <div style={{ minWidth: 860 }}>
                    {/* header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `120px repeat(${orderedCriteria.length}, minmax(110px, 1fr))`,
                        gap: 8,
                        padding: "10px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.14)",
                        opacity: 0.85,
                        fontSize: 12,
                      }}
                    >
                      <div>Wein</div>
                      {orderedCriteria.map((c) => (
                        <div key={c.id} style={{ textAlign: "right" }}>
                          {c.label}
                        </div>
                      ))}
                    </div>

                    {/* rows */}
                    {ranking.map((r) => (
                      <div
                        key={`hm-${r.blindNumber}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: `120px repeat(${orderedCriteria.length}, minmax(110px, 1fr))`,
                          gap: 8,
                          padding: "10px 12px",
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>#{r.blindNumber}</div>

                        {orderedCriteria.map((c) => {
                          const v = safeNum(r.perCrit?.[c.id]);
                          const t = v == null ? 0 : clamp((v - scaleMin) / (scaleMax - scaleMin), 0, 1);
                          const bg = v == null ? "rgba(255,255,255,0.06)" : scoreBg(t);
                          const col = v == null ? "rgba(255,255,255,0.65)" : scoreColor(t);

                          return (
                            <div
                              key={c.id}
                              style={{
                                textAlign: "right",
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: bg,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              <span style={{ color: col, fontWeight: 950 }}>
                                {v == null ? "—" : v.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* tiny animations */}
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

/* --- styles --- */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
};

const pageStyleTv: React.CSSProperties = {
  // nothing heavy; TV mode is mostly spacing/typography
};

const wrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 1100,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 14,
};

const wrapStyleTv: React.CSSProperties = {
  maxWidth: 1400,
  padding: 28,
  gap: 18,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  color: "white",
  gap: 12,
  flexWrap: "wrap",
};

const headerStyleTv: React.CSSProperties = {
  alignItems: "center",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(20,20,20,0.78)",
  backdropFilter: "blur(6px)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  padding: 18,
  color: "white",
  boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
};

const errorStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: "rgba(255,80,80,0.55)",
  color: "#ffb4b4",
};

const codeStyle: React.CSSProperties = {
  padding: "2px 6px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const ghostLinkStyle: React.CSSProperties = {
  ...ghostBtnStyle,
  textDecoration: "none",
  display: "inline-block",
};

const podiumGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 12,
};

const podiumGridTv: React.CSSProperties = {
  gap: 16,
};

const podiumCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const podiumWinner: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
};

const bigScore: React.CSSProperties = {
  marginTop: 8,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  fontWeight: 950,
  fontSize: 22,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: 0.3,
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

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  fontSize: 12,
  borderBottom: "1px solid rgba(255,255,255,0.14)",
  opacity: 0.85,
  letterSpacing: 0.2,
};

const td: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: 14,
  verticalAlign: "top",
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
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
