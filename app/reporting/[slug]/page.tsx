"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  displayName?: string | null;
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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * ✅ Robust: unterstützt perCrit by criterionId ODER by label
 */
function getCritScore(row: SummaryRow, critId: string, critLabel: string): number | null {
  const v1 = row.perCrit?.[critId];
  if (typeof v1 === "number") return v1;

  const v2 = row.perCrit?.[critLabel];
  if (typeof v2 === "number") return v2;

  return null;
}

function scoreText(v: number | null, digits = 2) {
  if (v == null || typeof v !== "number") return "—";
  return v.toFixed(digits);
}

function emojiRank(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "🏅";
}

function wineTitle(w: WineSlotPublic | undefined, blindNumber: number) {
  if (!w) return `Wein #${blindNumber}`;
  const parts = [w.winery, w.displayName, w.grape, w.vintage].filter(Boolean);
  return parts.length ? parts.join(" · ") : `Wein #${blindNumber}`;
}

export default function ReportingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug || "");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [expandedBlind, setExpandedBlind] = useState<number | null>(null);

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
    load();
    const t = window.setInterval(load, 10_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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

  const ranking = useMemo(() => {
    const rows = summary?.ranking?.length ? summary.ranking : summary?.rows ?? [];
    return rows
      .filter((r) => Number.isFinite(r.blindNumber))
      .slice()
      .sort((a, b) => {
        // primär: overall desc, nulls zuletzt
        if (a.overall == null && b.overall == null) return a.blindNumber - b.blindNumber;
        if (a.overall == null) return 1;
        if (b.overall == null) return -1;
        return b.overall - a.overall;
      });
  }, [summary]);

  const top3 = useMemo(() => ranking.slice(0, 3), [ranking]);

  // Für kleine Bars (UI)
  const overallMax = useMemo(() => {
    const vals = ranking.map((r) => (typeof r.overall === "number" ? r.overall : 0));
    return Math.max(10, ...vals); // falls Skala unbekannt: mindestens 10
  }, [ranking]);

  return (
    <div style={pageStyle}>
      {/* background */}
      <div style={bgImg} />
      <div style={bgOverlay} />

      <main style={wrap}>
        <header style={header}>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 26 }}>🍷 Reporting</h1>
              <span style={chip}>Live</span>
              <span style={{ opacity: 0.8, fontSize: 13 }}>
                Runde: <code style={code}>{slug}</code>
              </span>
            </div>

            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
              Auto-Refresh: alle 10 Sekunden · {summary ? `Ratings: ${summary.ratingCount}` : "—"}
            </div>
          </div>

          <button onClick={load} style={btn} disabled={loading}>
            {loading ? "Lade…" : "↻ Refresh"}
          </button>
        </header>

        {msg && <div style={errorCard}>{msg}</div>}

        {!summary && loading && (
          <div style={card}>
            <div style={{ opacity: 0.85 }}>Lade Daten…</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={skeleton} />
              <div style={skeleton} />
              <div style={skeleton} />
            </div>
          </div>
        )}

        {summary && (
          <>
            {/* KPI */}
            <section style={kpiGrid}>
              <div style={kpiCard}>
                <div style={kpiLabel}>Status</div>
                <div style={kpiValue}>{summary.status ?? "—"}</div>
              </div>
              <div style={kpiCard}>
                <div style={kpiLabel}>Weine</div>
                <div style={kpiValue}>{summary.wineCount}</div>
              </div>
              <div style={kpiCard}>
                <div style={kpiLabel}>Ratings</div>
                <div style={kpiValue}>{summary.ratingCount}</div>
              </div>
              <div style={kpiCard}>
                <div style={kpiLabel}>Kriterien</div>
                <div style={kpiValue}>{orderedCriteria.length}</div>
              </div>
            </section>

            {/* Top 3 */}
            <section style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h2 style={h2}>🏆 Top 3</h2>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  Werte live aus Ø-Scores · null = noch keine Ratings
                </div>
              </div>

              {!top3.length ? (
                <div style={{ opacity: 0.85 }}>Noch keine Auswertung verfügbar.</div>
              ) : (
                <div style={podium}>
                  {top3.map((r, idx) => {
                    const w = wineByBlind.get(r.blindNumber);
                    const isWinner = idx === 0;
                    return (
                      <div key={r.blindNumber} style={{ ...podiumCard, ...(isWinner ? podiumWinner : {}) }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 950, fontSize: 14 }}>
                              {emojiRank(idx)} Platz {idx + 1}
                            </div>
                            <div style={{ marginTop: 6, fontWeight: 900 }}>
                              Wein #{r.blindNumber}
                            </div>
                            <div style={{ marginTop: 4, opacity: 0.9, fontSize: 13 }}>
                              {wineTitle(w, r.blindNumber)}
                            </div>
                            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                              Mitgebracht von: <strong>{w?.ownerName ?? "—"}</strong>
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ opacity: 0.75, fontSize: 12 }}>Ø Score</div>
                            <div style={bigBadge}>{scoreText(r.overall, 2)}</div>
                          </div>
                        </div>

                        {/* mini criteria chips */}
                        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {orderedCriteria.slice(0, 3).map((c) => {
                            const v = getCritScore(r, c.id, c.label);
                            return (
                              <div key={c.id} style={pill}>
                                <span style={{ opacity: 0.8 }}>{c.label}</span>
                                <span style={{ fontWeight: 950 }}>{v == null ? "—" : v.toFixed(1)}</span>
                              </div>
                            );
                          })}
                          {orderedCriteria.length > 3 ? (
                            <div style={{ ...pill, opacity: 0.75 }}>+{orderedCriteria.length - 3} Kriterien</div>
                          ) : null}
                        </div>

                        {/* image */}
                        <div style={{ marginTop: 12 }}>
                          {w?.imageUrl ? (
                            <img
                              src={w.imageUrl}
                              alt="Flasche"
                              style={{
                                width: "100%",
                                height: 180,
                                objectFit: "cover",
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.14)",
                              }}
                            />
                          ) : (
                            <div style={imgPlaceholder}>Kein Bild</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Ranking Table */}
            <section style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h2 style={h2}>📊 Ranking</h2>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  Tap “Details” für Kriterien-Ø + Bild
                </div>
              </div>

              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>Wein</th>
                      <th style={thRight}>Ø</th>
                      <th style={th}>Bar</th>
                      <th style={th}>Aktion</th>
                    </tr>
                  </thead>

                  <tbody>
                    {ranking.map((r, i) => {
                      const w = wineByBlind.get(r.blindNumber);
                      const open = expandedBlind === r.blindNumber;
                      const ov = typeof r.overall === "number" ? r.overall : null;
                      const pct = ov == null ? 0 : clamp((ov / overallMax) * 100, 0, 100);

                      return (
                        <React.Fragment key={r.blindNumber}>
                          <tr style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                            <td style={td}>{i + 1}</td>

                            <td style={td}>
                              <div style={{ fontWeight: 950, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                                <span>Wein #{r.blindNumber}</span>
                                <span style={{ opacity: 0.85, fontSize: 13 }}>
                                  {wineTitle(w, r.blindNumber)}
                                </span>
                              </div>
                              <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                                Owner: <strong>{w?.ownerName ?? "—"}</strong>
                              </div>
                            </td>

                            <td style={tdRight}>
                              <span style={badge}>{scoreText(ov, 2)}</span>
                            </td>

                            <td style={td}>
                              <div style={barWrap}>
                                <div style={{ ...barFill, width: `${pct}%` }} />
                              </div>
                            </td>

                            <td style={td}>
                              <button style={miniBtn} onClick={() => setExpandedBlind(open ? null : r.blindNumber)}>
                                {open ? "Details schließen" : "Details"}
                              </button>
                              <a
                                href={`/t/${enc(slug)}/wine/${r.blindNumber}`}
                                style={miniLink}
                              >
                                Bewertung ↗
                              </a>
                            </td>
                          </tr>

                          {open && (
                            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                              <td style={{ ...td, paddingTop: 0 }} />
                              <td colSpan={4} style={{ ...td, paddingTop: 0 }}>
                                <div style={detailBox}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 12 }}>
                                    <div>
                                      <div style={{ fontWeight: 950, marginBottom: 10 }}>Ø je Kriterium</div>
                                      <div style={{ display: "grid", gap: 8 }}>
                                        {orderedCriteria.map((c) => {
                                          const v = getCritScore(r, c.id, c.label);
                                          return (
                                            <div
                                              key={c.id}
                                              style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                                            >
                                              <div style={{ opacity: 0.9 }}>{c.label}</div>
                                              <div style={{ fontVariantNumeric: "tabular-nums" }}>
                                                {v == null ? <span style={{ opacity: 0.6 }}>—</span> : <strong>{v.toFixed(2)}</strong>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div>
                                      {w?.imageUrl ? (
                                        <img
                                          src={w.imageUrl}
                                          alt="Flasche"
                                          style={{
                                            width: "100%",
                                            height: 220,
                                            objectFit: "cover",
                                            borderRadius: 14,
                                            border: "1px solid rgba(255,255,255,0.14)",
                                          }}
                                        />
                                      ) : (
                                        <div style={{ ...imgPlaceholder, height: 220 }}>Kein Bild</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
                Hinweis: Das Reporting ist “public”, zeigt aber nur Aggregation (Ø pro Wein).
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/* ===== Styles (Premium Level 2) ===== */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
};

const bgImg: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: "url('/join-bg.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  filter: "blur(2px)",
  transform: "scale(1.05)",
};

const bgOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.78) 55%, rgba(0,0,0,0.92) 100%)",
};

const wrap: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 1080,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 14,
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  color: "white",
  flexWrap: "wrap",
};

const card: React.CSSProperties = {
  background: "rgba(20,20,20,0.74)",
  backdropFilter: "blur(6px)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  padding: 18,
  color: "white",
  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
};

const errorCard: React.CSSProperties = {
  ...card,
  borderColor: "rgba(255,80,80,0.5)",
  color: "#ffb4b4",
};

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  fontSize: 12,
  fontWeight: 800,
};

const code: React.CSSProperties = {
  padding: "2px 6px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const skeleton: React.CSSProperties = {
  height: 14,
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.10)",
};

const kpiGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const kpiCard: React.CSSProperties = {
  ...card,
  padding: 14,
};

const kpiLabel: React.CSSProperties = {
  opacity: 0.75,
  fontSize: 12,
};

const kpiValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 20,
  fontWeight: 950,
  letterSpacing: 0.2,
};

const h2: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 950,
};

const podium: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const podiumCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const podiumWinner: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.22)",
  boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
};

const bigBadge: React.CSSProperties = {
  marginTop: 6,
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 950,
  fontSize: 22,
  fontVariantNumeric: "tabular-nums",
};

const pill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  display: "inline-flex",
  gap: 8,
  alignItems: "baseline",
};

const imgPlaceholder: React.CSSProperties = {
  width: "100%",
  height: 180,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: 0.7,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.16)",
  fontSize: 12,
  opacity: 0.9,
};

const thRight: React.CSSProperties = { ...th, textAlign: "right" };

const td: React.CSSProperties = {
  padding: "12px 10px",
  verticalAlign: "top",
  fontSize: 14,
};

const tdRight: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.10)",
  fontWeight: 950,
  minWidth: 76,
  textAlign: "right",
};

const barWrap: React.CSSProperties = {
  height: 10,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const barFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(192,57,43,0.9), rgba(142,14,0,0.95))",
};

const miniBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  marginRight: 10,
};

const miniLink: React.CSSProperties = {
  color: "white",
  opacity: 0.9,
  textDecoration: "underline",
  fontWeight: 900,
};

const detailBox: React.CSSProperties = {
  marginTop: 6,
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
};
