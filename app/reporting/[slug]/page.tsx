// app/reporting/[slug]/page.tsx
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

function encode(s: string) {
  return encodeURIComponent(s);
}

function fmt(v: number | null, digits = 2) {
  if (v === null || typeof v !== "number") return "—";
  return v.toFixed(digits);
}

export default function ReportingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug || "");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ Filter UI (jetzt: unten + zugeklappt)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [onlyRated, setOnlyRated] = useState(false);
  const [onlyTop, setOnlyTop] = useState(false);
  const [minOverall, setMinOverall] = useState<string>(""); // string => stabile inputs
  const [search, setSearch] = useState("");

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

  useEffect(() => {
    load();
    const t = window.setInterval(load, 10_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ✅ Reporting IMMER sichtbar
  const revealed = true;

  const wineByBlind = useMemo(() => {
    const map = new Map<number, WineSlotPublic>();
    for (const w of wines?.wines ?? []) {
      if (typeof w.blindNumber === "number") map.set(w.blindNumber, w);
    }
    return map;
  }, [wines]);

  const top3 = useMemo(() => {
    return (summary?.ranking ?? []).slice(0, 3);
  }, [summary]);

  const orderedCriteria = useMemo(() => {
    return (summary?.criteria ?? []).slice().sort((a, b) => a.order - b.order);
  }, [summary]);

  // ✅ Base ranking (wie vorher)
  const baseRanking = useMemo(() => {
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

  // ✅ Filters (visual only)
  const filteredRanking = useMemo(() => {
    let rows = baseRanking.slice();

    if (onlyTop && rows.length) {
      rows = rows.slice(0, 3);
    }

    if (onlyRated) {
      rows = rows.filter((r) => typeof r.overall === "number");
    }

    const min = minOverall.trim() === "" ? null : Number(minOverall);
    if (min !== null && Number.isFinite(min)) {
      rows = rows.filter((r) => (typeof r.overall === "number" ? r.overall >= min : false));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const w = wineByBlind.get(r.blindNumber);
        const hay = [
          `wein ${r.blindNumber}`,
          w?.winery ?? "",
          w?.grape ?? "",
          w?.vintage ?? "",
          w?.ownerName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return rows;
  }, [baseRanking, onlyTop, onlyRated, minOverall, search, wineByBlind]);

  const hasAnyFilter = useMemo(() => {
    return onlyRated || onlyTop || minOverall.trim() !== "" || search.trim() !== "";
  }, [onlyRated, onlyTop, minOverall, search]);

  function resetFilters() {
    setOnlyRated(false);
    setOnlyTop(false);
    setMinOverall("");
    setSearch("");
  }

  return (
    <div style={pageStyle}>
      {/* background */}
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
                        <div>
                          <div style={{ fontWeight: 800 }}>
                            #{i + 1} · Wein #{r.blindNumber} ·{" "}
                            {typeof r.overall === "number" ? r.overall.toFixed(2) : "—"}
                          </div>
                          <div style={{ opacity: 0.9 }}>
                            <b>{w?.winery ?? "—"}</b>
                            {w?.grape ? ` · ${w.grape}` : ""}
                            {w?.vintage ? ` · ${w.vintage}` : ""}
                          </div>
                          <div style={{ fontSize: 13, opacity: 0.8 }}>
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

            {/* RANKING */}
            <section style={cardStyle}>
              <h2 style={h2Style}>📊 Ranking</h2>

              {hasAnyFilter && (
                <div style={activeFilterBar}>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    Filter aktiv · Zeilen: <b>{filteredRanking.length}</b>
                  </div>
                  <button onClick={resetFilters} style={activeFilterResetBtn}>
                    Filter zurücksetzen
                  </button>
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 740 }}>
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
                    {filteredRanking.map((r, i) => {
                      const w = wineByBlind.get(r.blindNumber);
                      return (
                        <tr key={r.blindNumber} style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                          <td style={tdStyle}>{i + 1}</td>
                          <td style={tdStyle}>#{r.blindNumber}</td>
                          <td style={tdStyle}>{fmt(r.overall, 2)}</td>

                          {orderedCriteria.map((c) => (
                            <td key={c.id} style={tdStyle}>
                              {typeof r.perCrit?.[c.id] === "number" ? fmt(r.perCrit[c.id]!, 2) : "—"}
                            </td>
                          ))}

                          <td style={tdStyle}>{w?.ownerName ?? "—"}</td>
                          <td style={tdStyle}>
                            {w?.winery ?? "—"}
                            {w?.vintage ? ` · ${w.vintage}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* LINKS + BEWERTEN */}
            {revealed && (
              <section style={{ ...cardStyle, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href={`/t/${encode(slug)}`} style={linkStyle}>
                  Teilnehmer-Übersicht →
                </a>

                <a href={`/join?slug=${encode(slug)}`} style={linkStyle} target="_blank" rel="noreferrer">
                  Join öffnen →
                </a>

                {Array.from({ length: summary.wineCount }).map((_, i) => {
                  const bn = i + 1;
                  return (
                    <a key={bn} href={`/t/${encode(slug)}/wine/${bn}`} style={linkStyle}>
                      Wein #{bn} bewerten →
                    </a>
                  );
                })}
              </section>
            )}

            {/* ✅ FILTER (NEU: ganz unten + zugeklappt) */}
            <section style={cardStyle}>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                style={filterToggleBtn}
                aria-expanded={filtersOpen}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 900 }}>Filter</span>
                  {hasAnyFilter ? <span style={filterActivePill}>aktiv</span> : <span style={filterInactivePill}>aus</span>}
                </span>

                <span style={{ opacity: 0.85, fontWeight: 800 }}>{filtersOpen ? "▲" : "▼"}</span>
              </button>

              <div
                style={{
                  maxHeight: filtersOpen ? 420 : 0,
                  overflow: "hidden",
                  transition: "max-height 240ms ease",
                }}
              >
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <label style={checkLabel}>
                      <input
                        type="checkbox"
                        checked={onlyRated}
                        onChange={(e) => setOnlyRated(e.target.checked)}
                      />
                      nur bewertete Weine
                    </label>

                    <label style={checkLabel}>
                      <input
                        type="checkbox"
                        checked={onlyTop}
                        onChange={(e) => setOnlyTop(e.target.checked)}
                      />
                      nur Top 3
                    </label>
                  </div>

                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                    <label style={fieldLabel}>
                      Mindest-Overall
                      <input
                        value={minOverall}
                        onChange={(e) => setMinOverall(e.target.value)}
                        placeholder="z.B. 7.50"
                        inputMode="decimal"
                        style={fieldInput}
                      />
                    </label>

                    <label style={fieldLabel}>
                      Suche
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Weingut, Owner, Jahrgang…"
                        style={fieldInput}
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" onClick={resetFilters} style={resetBtn}>
                      Filter zurücksetzen
                    </button>

                    <div style={{ opacity: 0.75, fontSize: 12, alignSelf: "center" }}>
                      Zeilen nach Filter: <b>{filteredRanking.length}</b>
                    </div>
                  </div>

                  <p style={{ margin: 0, opacity: 0.65, fontSize: 12 }}>
                    Hinweis: Filter wirken nur auf die Anzeige (kein Datenverlust).
                  </p>
                </div>
              </div>
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
  fontFamily: "system-ui",
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
  color: "white",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(20,20,20,0.75)",
  backdropFilter: "blur(6px)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  padding: 18,
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
};

const tdStyle: React.CSSProperties = {
  padding: 10,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.1)",
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
};

/* ✅ Filter UI */
const filterToggleBtn: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  cursor: "pointer",
};

const filterActivePill: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.14)",
  fontSize: 12,
  fontWeight: 900,
};

const filterInactivePill: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.85,
};

const checkLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  fontSize: 13,
};

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  opacity: 0.9,
};

const fieldInput: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(0,0,0,0.20)",
  color: "white",
  outline: "none",
};

const resetBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const activeFilterBar: React.CSSProperties = {
  margin: "8px 0 12px 0",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const activeFilterResetBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
};
