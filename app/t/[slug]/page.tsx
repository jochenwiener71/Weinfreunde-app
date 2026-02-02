"use client";

import { useEffect, useMemo, useState } from "react";

type Summary = {
  ok: boolean;
  publicSlug: string;
  tastingId: string;
  status: string | null;
  wineCount: number;
  criteria: { id: string; label: string; order: number }[];
  rows: {
    blindNumber: number;
    perCrit: Record<string, number | null>;
    overall: number | null;
  }[];
  ranking: {
    blindNumber: number;
    perCrit: Record<string, number | null>;
    overall: number | null;
  }[];
  ratingCount: number;
};

type WinePublic = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;

  // optional (falls du es später auch öffentlich liefern willst)
  imageUrl?: string | null;
  imagePath?: string | null;
};

type WinesResponse = {
  ok: boolean;
  publicSlug: string;
  tastingId: string;
  status: string;
  wineCount: number;
  wines: WinePublic[];
};

function fmt(v: any) {
  if (v == null) return "—";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  return String(v);
}

export default function TastingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug || "");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);

  async function loadAll(silent = false) {
    if (!silent) {
      setLoading(true);
      setMsg(null);
    }

    try {
      const [resS, resW] = await Promise.all([
        fetch(`/api/tasting/summary?publicSlug=${encodeURIComponent(slug)}`, { cache: "no-store" }),
        fetch(`/api/tasting/wines?publicSlug=${encodeURIComponent(slug)}`, { cache: "no-store" }),
      ]);

      const textS = await resS.text();
      const textW = await resW.text();

      const jsonS = textS ? (() => { try { return JSON.parse(textS); } catch { return { error: textS }; } })() : {};
      const jsonW = textW ? (() => { try { return JSON.parse(textW); } catch { return { error: textW }; } })() : {};

      if (!resS.ok) throw new Error(jsonS?.error ?? `Summary HTTP ${resS.status}`);
      if (!resW.ok) throw new Error(jsonW?.error ?? `Wines HTTP ${resW.status}`);

      setSummary(jsonS as Summary);
      setWines(jsonW as WinesResponse);

      const now = new Date();
      setLastAt(now.toLocaleTimeString());
      if (!silent) setMsg("Aktualisiert ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler beim Laden");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // initial load + auto refresh
  useEffect(() => {
    loadAll(true);
    const t = window.setInterval(() => loadAll(true), 8000); // alle 8s
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const wineByBlind = useMemo(() => {
    const map = new Map<number, WinePublic>();
    for (const w of wines?.wines ?? []) {
      if (typeof w.blindNumber === "number") map.set(w.blindNumber, w);
    }
    return map;
  }, [wines]);

  const top3 = useMemo(() => {
    const r = (summary?.ranking ?? []).filter((x) => typeof x.overall === "number");
    return r.slice(0, 3);
  }, [summary]);

  const status = summary?.status ?? wines?.status ?? null;
  const canShowDetails = (w: WinePublic | undefined) => {
    // Wir zeigen Details, wenn sie vom Endpoint geliefert werden (unabhängig vom Status).
    // Falls dein /api/tasting/wines Details nur bei "revealed" liefert, bleiben sie hier automatisch leer.
    if (!w) return false;
    return Boolean(w.ownerName || w.winery || w.grape || w.vintage || w.imageUrl);
  };

  return (
    <div style={pageStyle}>
      {/* Background (wie Join) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/join-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(2px)",
          transform: "scale(1.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.80) 65%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      <main style={wrapStyle}>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>🍷 {slug}</h1>
              <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
                Status: <b>{status ?? "—"}</b> · Ratings: <b>{summary?.ratingCount ?? "—"}</b>
                {lastAt ? <span> · zuletzt: {lastAt}</span> : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <a href={`/t/${encodeURIComponent(slug)}/wine/1`} style={primaryBtn}>
                Zur Bewertung →
              </a>
              <button onClick={() => loadAll(false)} disabled={loading} style={ghostBtn}>
                {loading ? "…" : "Refresh"}
              </button>
            </div>
          </div>

          {msg && (
            <p style={{ marginTop: 12, color: msg.includes("✅") ? "white" : "#ffb4b4" }}>
              {msg}
            </p>
          )}

          {/* TOP 3 */}
          <section style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 10px 0", fontSize: 16, opacity: 0.95 }}>Top 3 (aktueller Stand)</h2>

            {!summary ? (
              <p style={{ opacity: 0.8, margin: 0 }}>Lade…</p>
            ) : top3.length === 0 ? (
              <p style={{ opacity: 0.8, margin: 0 }}>
                Noch kein Ranking verfügbar (es müssen Bewertungen eingehen).
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {top3.map((r, idx) => {
                  const w = wineByBlind.get(r.blindNumber);
                  const hasDetails = canShowDetails(w);

                  return (
                    <div key={r.blindNumber} style={topCardStyle}>
                      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                        {/* Optional image */}
                        {w?.imageUrl ? (
                          <img
                            src={w.imageUrl}
                            alt={`Wein ${r.blindNumber}`}
                            style={{
                              width: 84,
                              height: 120,
                              objectFit: "cover",
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.18)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 84,
                              height: 120,
                              borderRadius: 10,
                              border: "1px dashed rgba(255,255,255,0.22)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: 0.75,
                              fontSize: 12,
                            }}
                          >
                            kein Bild
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 12, opacity: 0.8 }}>
                                #{idx + 1} · Wein <b>#{r.blindNumber}</b>
                              </div>
                              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>
                                Ø Gesamt: {fmt(r.overall)}
                              </div>
                            </div>

                            <a
                              href={`/t/${encodeURIComponent(slug)}/wine/${r.blindNumber}`}
                              style={{ ...pillLinkStyle }}
                            >
                              bewerten →
                            </a>
                          </div>

                          {/* Details block */}
                          {hasDetails ? (
                            <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 13 }}>
                              {w?.winery ? <div><b>Weingut:</b> {w.winery}</div> : null}
                              {/* optional "Name Wein" falls du es später ergänzt */}
                              {w?.grape ? <div><b>Rebsorte:</b> {w.grape}</div> : null}
                              {w?.vintage ? <div><b>Jahrgang:</b> {w.vintage}</div> : null}
                              {w?.ownerName ? <div><b>Mitgebracht von:</b> {w.ownerName}</div> : null}
                            </div>
                          ) : (
                            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                              Details erscheinen, sobald der Admin sie einträgt (oder nach Reveal, je nach Endpoint-Logik).
                            </div>
                          )}

                          {/* per criteria */}
                          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {Object.entries(r.perCrit ?? {}).map(([k, v]) => (
                              <span key={k} style={chipStyle}>
                                {k}: <b style={{ marginLeft: 6 }}>{v == null ? "—" : fmt(v)}</b>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* LIST */}
          <section style={{ marginTop: 18 }}>
            <h2 style={{ margin: "0 0 10px 0", fontSize: 16, opacity: 0.95 }}>Alle Weine</h2>

            <div style={{ display: "grid", gap: 10 }}>
              {Array.from({ length: summary?.wineCount ?? wines?.wineCount ?? 10 }, (_, i) => i + 1).map((bn) => {
                const w = wineByBlind.get(bn);
                const details = canShowDetails(w);

                return (
                  <a
                    key={bn}
                    href={`/t/${encodeURIComponent(slug)}/wine/${bn}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "12px 12px",
                      borderRadius: 12,
                      textDecoration: "none",
                      color: "white",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>Wein #{bn}</div>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                        {details
                          ? `${w?.winery ?? "—"} · ${w?.grape ?? "—"} · ${w?.vintage ?? "—"}`
                          : "Details folgen…"}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
                      öffnen →
                    </div>
                  </a>
                );
              })}
            </div>

            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
              Auto-Refresh ist aktiv. Wenn du willst, stelle ich die Frequenz auf 3s/5s/15s um.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

/* Styles */
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
  padding: 18,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 920,
  marginTop: 14,
  background: "rgba(20,20,20,0.72)",
  backdropFilter: "blur(7px)",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.10)",
};

const topCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  padding: 14,
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.22)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 12,
  opacity: 0.95,
};

const primaryBtn: React.CSSProperties = {
  display: "inline-block",
  textAlign: "center",
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "white",
  fontWeight: 800,
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 700,
};

const pillLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 10px",
  borderRadius: 999,
  textDecoration: "none",
  color: "white",
  fontSize: 12,
  fontWeight: 800,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
};
