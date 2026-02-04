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

  // ✅ bottle photo
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

function encode(s: string) {
  return encodeURIComponent(s);
}

export default function ReportingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug || "");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    setLoading(true);

    try {
      const [sRes, wRes] = await Promise.all([
        fetch(`/api/tasting/summary?publicSlug=${encode(slug)}`, { cache: "no-store" }),
        fetch(`/api/tasting/wines?publicSlug=${encode(slug)}`, { cache: "no-store" }),
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

  // initial load + auto refresh
  useEffect(() => {
    load();
    const t = window.setInterval(load, 10_000); // ✅ 10s
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const revealed = useMemo(() => {
    const st = String(summary?.status ?? wines?.status ?? "").toLowerCase();
    return st === "revealed";
  }, [summary?.status, wines?.status]);

  const wineByBlind = useMemo(() => {
    const map = new Map<number, WineSlotPublic>();
    for (const w of wines?.wines ?? []) {
      if (typeof w.blindNumber === "number") map.set(w.blindNumber, w);
    }
    return map;
  }, [wines]);

  const top3 = useMemo(() => {
    const r = summary?.ranking ?? [];
    return r.slice(0, 3);
  }, [summary]);

  const allRanking = useMemo(() => {
    const rows = summary?.ranking ?? [];
    // falls ranking leer ist, nutze rows
    const base = rows.length ? rows : (summary?.rows ?? []);
    return base
      .filter((x) => x && typeof x.blindNumber === "number")
      .slice()
      .sort((a, b) => (b.overall ?? -999) - (a.overall ?? -999));
  }, [summary]);

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
          filter: "blur(2px)",
          transform: "scale(1.05)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.78) 60%, rgba(0,0,0,0.9) 100%)",
        }}
      />

      <main style={wrapStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26 }}>🍷 Reporting</h1>
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
                <div style={{ opacity: 0.9 }}>
                  Status: <b>{String(summary.status ?? "-")}</b> · Ratings: <b>{summary.ratingCount}</b>
                </div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  Auto-Refresh: alle 10 Sekunden
                </div>
              </div>

              {!revealed && (
                <p style={{ marginTop: 10, opacity: 0.85 }}>
                  Details (Weingut/Owner/Bild) werden erst nach <b>revealed</b> angezeigt.
                </p>
              )}
            </section>

            {/* TOP 3 */}
            <section style={cardStyle}>
              <h2 style={h2Style}>🏆 Top 3</h2>

              <div style={{ display: "grid", gap: 12 }}>
                {top3.length === 0 ? (
                  <p style={{ margin: 0, opacity: 0.85 }}>Noch keine Auswertung verfügbar.</p>
                ) : (
                  top3.map((r, idx) => {
                    const w = wineByBlind.get(r.blindNumber);
                    return (
                      <div key={`${r.blindNumber}-${idx}`} style={topRowStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={placeStyle}>{idx + 1}</div>

                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800 }}>
                              Wein #{r.blindNumber}
                              <span style={{ opacity: 0.75, fontWeight: 600 }}>
                                {" "}
                                · Score: {typeof r.overall === "number" ? r.overall.toFixed(2) : "—"}
                              </span>
                            </div>

                            {revealed ? (
                              <div style={{ marginTop: 6, opacity: 0.92, lineHeight: 1.35 }}>
                                <div>
                                  <b>{w?.winery ?? "—"}</b>
                                  {w?.grape ? ` · ${w.grape}` : ""}
                                  {w?.vintage ? ` · ${w.vintage}` : ""}
                                </div>
                                <div style={{ opacity: 0.85 }}>
                                  Mitgebracht von: <b>{w?.ownerName ?? "—"}</b>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginTop: 6, opacity: 0.8 }}>
                                (Details folgen nach Reveal)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* photo */}
                        {revealed && w?.imageUrl ? (
                          <img
                            src={w.imageUrl}
                            alt="Flasche"
                            style={{
                              width: 64,
                              height: 96,
                              objectFit: "cover",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.16)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 64,
                              height: 96,
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.16)",
                              background: "rgba(255,255,255,0.06)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              opacity: 0.7,
                            }}
                          >
                            —
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* RANKING TABLE */}
            <section style={cardStyle}>
              <h2 style={h2Style}>📊 Ranking</h2>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Wein</th>
                      <th style={thStyle}>Overall</th>
                      {summary.criteria
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((c) => (
                          <th key={c.id} style={thStyle}>
                            {c.label}
                          </th>
                        ))}
                      {revealed && <th style={thStyle}>Owner</th>}
                      {revealed && <th style={thStyle}>Weingut</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {allRanking.map((r, i) => {
                      const w = wineByBlind.get(r.blindNumber);
                      return (
                        <tr key={`${r.blindNumber}-${i}`} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                          <td style={tdStyle}>{i + 1}</td>
                          <td style={tdStyle}>
                            <b>#{r.blindNumber}</b>
                          </td>
                          <td style={tdStyle}>
                            {typeof r.overall === "number" ? r.overall.toFixed(2) : "—"}
                          </td>

                          {summary.criteria
                            .slice()
                            .sort((a, b) => a.order - b.order)
                            .map((c) => {
                              const v = r.perCrit?.[c.label];
                              return (
                                <td key={c.id} style={tdStyle}>
                                  {typeof v === "number" ? v.toFixed(2) : "—"}
                                </td>
                              );
                            })}

                          {revealed && <td style={tdStyle}>{w?.ownerName ?? "—"}</td>}
                          {revealed && (
                            <td style={tdStyle}>
                              {w?.winery ?? "—"}
                              {w?.vintage ? ` · ${w.vintage}` : ""}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* quick links */}
            <section style={{ ...cardStyle, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`/t/${encode(slug)}`} style={linkStyle}>
                Teilnehmer-Übersicht →
              </a>
              <a href={`/join?slug=${encode(slug)}`} style={linkStyle} target="_blank" rel="noreferrer">
                Join öffnen →
              </a>
            </section>
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
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
};

const wrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 980,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  color: "white",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(20,20,20,0.75)",
  backdropFilter: "blur(6px)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  padding: 18,
  color: "white",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};

const h2Style: React.CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 16,
  letterSpacing: 0.2,
};

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: "rgba(255,80,80,0.5)",
  color: "#ffb4b4",
};

const codeStyle: React.CSSProperties = {
  padding: "2px 6px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
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

const placeStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.16)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  fontSize: 12,
  opacity: 0.85,
  borderBottom: "1px solid rgba(255,255,255,0.14)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: 10,
  fontSize: 13,
  opacity: 0.95,
  whiteSpace: "nowrap",
};

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
};
