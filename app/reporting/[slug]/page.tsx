"use client";

import { useEffect, useMemo, useState } from "react";

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

function fmt(v: number | null, digits = 2) {
  if (typeof v !== "number") return "—";
  return v.toFixed(digits);
}

function wineLine(w?: WineSlotPublic) {
  if (!w) return "—";
  const parts = [w.winery, w.grape, w.vintage].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default function ReportingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug || "");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Mobile detection (portrait friendly)
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const apply = () => setIsNarrow(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const [expanded, setExpanded] = useState<number | null>(null);

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

  // Reporting IMMER sichtbar
  const revealed = true;

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

  const allRanking = useMemo(() => {
    const rows = summary?.ranking?.length ? summary.ranking : summary?.rows ?? [];
    return rows
      .filter((r) => typeof r.blindNumber === "number")
      .slice()
      .sort((a, b) => {
        if (a.overall == null && b.overall == null) return a.blindNumber - b.blindNumber;
        if (a.overall == null) return 1;
        if (b.overall == null) return -1;
        return b.overall - a.overall;
      });
  }, [summary]);

  const top3 = useMemo(() => (summary?.ranking ?? []).slice(0, 3), [summary]);

  return (
    <div style={pageStyle}>
      {/* background */}
      <div style={bgImg} />
      <div style={bgOverlay} />

      <main style={wrapStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: isNarrow ? 22 : 26 }}>🍷 Reporting</h1>
            <p style={{ margin: "6px 0 0 0", opacity: 0.8 }}>
              Runde: <code style={codeStyle}>{slug}</code>
            </p>
          </div>

          <button onClick={load} style={btnStyle}>
            ↻ Refresh
          </button>
        </header>

        {msg && <div style={errorStyle}>{msg}</div>}

        {loading && !summary && (
          <div style={cardStyle}>
            <p style={{ margin: 0, opacity: 0.85 }}>Lade…</p>
          </div>
        )}

        {summary && (
          <>
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  Status: <b>{summary.status ?? "—"}</b> · Ratings: <b>{summary.ratingCount}</b>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Auto-Refresh: alle 10 Sekunden</div>
              </div>
            </section>

            {/* TOP 3 */}
            <section style={cardStyle}>
              <h2 style={h2Style}>🏆 Top 3</h2>

              {top3.length === 0 ? (
                <p style={{ margin: 0, opacity: 0.85 }}>Noch keine Auswertung verfügbar.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {top3.map((r, i) => {
                    const w = wineByBlind.get(r.blindNumber);
                    return (
                      <div key={r.blindNumber} style={topRowStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900 }}>
                            #{i + 1} · Wein #{r.blindNumber} · {fmt(r.overall, 2)}
                          </div>
                          <div style={{ opacity: 0.9, marginTop: 4, wordBreak: "break-word" }}>
                            <b>{w?.winery ?? "—"}</b>
                            {w?.grape ? ` · ${w.grape}` : ""}
                            {w?.vintage ? ` · ${w.vintage}` : ""}
                          </div>
                          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                            Mitgebracht von: {w?.ownerName ?? "—"}
                          </div>
                        </div>

                        {w?.imageUrl ? (
                          <img
                            src={w.imageUrl}
                            alt="Flasche"
                            style={{
                              width: 64,
                              height: 96,
                              objectFit: "cover",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.16)",
                              flex: "0 0 auto",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 64,
                              height: 96,
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.16)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: 0.6,
                              flex: "0 0 auto",
                            }}
                          >
                            —
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* RANKING: Mobile = Cards, Desktop = Table */}
            <section style={cardStyle}>
              <h2 style={h2Style}>📊 Ranking</h2>

              {!revealed ? (
                <p style={{ margin: 0, opacity: 0.85 }}>Noch nicht veröffentlicht.</p>
              ) : isNarrow ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {allRanking.map((r, i) => {
                    const w = wineByBlind.get(r.blindNumber);
                    const isOpen = expanded === r.blindNumber;

                    return (
                      <div key={r.blindNumber} style={mobileCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: 14 }}>
                              #{i + 1} · Wein #{r.blindNumber}
                            </div>
                            <div style={{ opacity: 0.9, marginTop: 4, wordBreak: "break-word" }}>
                              {wineLine(w)}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                              Owner: {w?.ownerName ?? "—"}
                            </div>
                          </div>

                          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>Overall</div>
                            <div style={scorePill}>{fmt(r.overall, 2)}</div>
                          </div>
                        </div>

                        {/* Image + actions */}
                        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                          {w?.imageUrl ? (
                            <img
                              src={w.imageUrl}
                              alt="Flasche"
                              style={{
                                width: 54,
                                height: 78,
                                objectFit: "cover",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.16)",
                                flex: "0 0 auto",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 54,
                                height: 78,
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.16)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: 0.6,
                                flex: "0 0 auto",
                              }}
                            >
                              —
                            </div>
                          )}

                          <button
                            onClick={() => setExpanded(isOpen ? null : r.blindNumber)}
                            style={smallBtn}
                          >
                            {isOpen ? "Details schließen" : "Details"}
                          </button>

                          <a
                            href={`/t/${enc(slug)}/wine/${r.blindNumber}`}
                            style={smallLinkBtn}
                          >
                            Bewertung ↗
                          </a>
                        </div>

                        {/* Smooth open details */}
                        <div
                          style={{
                            maxHeight: isOpen ? 420 : 0,
                            overflow: "hidden",
                            transition: "max-height 260ms ease",
                          }}
                        >
                          <div style={{ paddingTop: isOpen ? 12 : 0 }}>
                            <div style={{ fontWeight: 900, marginBottom: 8, opacity: 0.95 }}>
                              Ø je Kriterium
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              {orderedCriteria.map((c) => {
                                const v = r.perCrit?.[c.id] ?? null;
                                return (
                                  <div key={c.id} style={critChip}>
                                    <div style={{ opacity: 0.9, fontSize: 12 }}>{c.label}</div>
                                    <div style={{ fontWeight: 950, fontVariantNumeric: "tabular-nums" }}>
                                      {fmt(v, 2)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                              Weingut: {w?.winery ?? "—"}
                              {w?.vintage ? ` · ${w.vintage}` : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Desktop table: scroll enabled, wrap enabled, minimum width
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Wein</th>
                        <th style={thStyle}>Overall</th>
                        {orderedCriteria.map((c) => (
                          <th key={c.id} style={thStyle}>
                            {c.label}
                          </th>
                        ))}
                        <th style={thStyle}>Owner</th>
                        <th style={thStyle}>Weingut</th>
                      </tr>
                    </thead>

                    <tbody>
                      {allRanking.map((r, i) => {
                        const w = wineByBlind.get(r.blindNumber);
                        return (
                          <tr key={r.blindNumber} style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                            <td style={tdStyle}>{i + 1}</td>
                            <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>#{r.blindNumber}</td>
                            <td style={tdStyle}>{fmt(r.overall, 2)}</td>

                            {orderedCriteria.map((c) => (
                              <td key={c.id} style={tdStyle}>
                                {fmt(r.perCrit?.[c.id] ?? null, 2)}
                              </td>
                            ))}

                            <td style={tdStyle}>{w?.ownerName ?? "—"}</td>
                            <td style={{ ...tdStyle, whiteSpace: "normal" }}>
                              {wineLine(w)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* LINKS */}
            <section style={{ ...cardStyle, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`/t/${enc(slug)}`} style={linkStyle}>
                Teilnehmer-Übersicht →
              </a>

              <a href={`/join?slug=${enc(slug)}`} style={linkStyle} target="_blank" rel="noreferrer">
                Join öffnen →
              </a>
            </section>

            <p style={{ marginTop: 4, opacity: 0.7, fontSize: 12, color: "white" }}>
              Mobile: Ranking als Cards · Desktop: Tabelle mit horizontalem Scroll.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

/* styles */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  fontFamily: "system-ui",
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
  background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.78) 60%, rgba(0,0,0,0.9) 100%)",
};

const wrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
  display: "grid",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "white",
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(20,20,20,0.75)",
  backdropFilter: "blur(6px)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  padding: 16,
  color: "white",
};

const h2Style: React.CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 16,
};

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.1)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const errorStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: "rgba(255,80,80,0.5)",
  color: "#ffb4b4",
};

const codeStyle: React.CSSProperties = {
  padding: "2px 6px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.1)",
};

const topRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  fontSize: 12,
  borderBottom: "1px solid rgba(255,255,255,0.14)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: 10,
  fontSize: 13,
  verticalAlign: "top",
  fontVariantNumeric: "tabular-nums",
};

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.1)",
  color: "white",
  textDecoration: "none",
  fontWeight: 800,
};

const mobileCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
};

const scorePill: React.CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.10)",
  fontWeight: 950,
  minWidth: 70,
  textAlign: "right",
};

const smallBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const smallLinkBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  textDecoration: "none",
  fontWeight: 900,
};

const critChip: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
};
