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
};

type WinesResponse = {
  ok: true;
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

function safeStr(s: any) {
  return String(s ?? "").toLowerCase().trim();
}

export default function ReportingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug || "");
  const REFRESH_SECONDS = 10;

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(REFRESH_SECONDS);

  const [isNarrow, setIsNarrow] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // FILTER STATE (unten, nur bei Klick sichtbar)
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyRated, setOnlyRated] = useState(false);
  const [onlyWithImage, setOnlyWithImage] = useState(false);
  const [sortMode, setSortMode] = useState<"rank" | "blind">("rank");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const apply = () => setIsNarrow(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  async function load({ silent } = { silent: false }) {
    if (!silent) setMsg(null);
    setLoading(true);
    setIsRefreshing(true);

    try {
      const [sRes, wRes] = await Promise.all([
        fetch(`/api/tasting/summary?publicSlug=${enc(slug)}`, { cache: "no-store" }),
        fetch(`/api/tasting/wines?publicSlug=${enc(slug)}`, { cache: "no-store" }),
      ]);

      const sJson = await sRes.json();
      const wJson = await wRes.json();

      if (!sRes.ok) throw new Error(sJson?.error ?? "Summary failed");
      if (!wRes.ok) throw new Error(wJson?.error ?? "Wines failed");

      setSummary(sJson);
      setWines(wJson);
      setLastUpdatedAt(Date.now());
      setNextRefreshIn(REFRESH_SECONDS);
    } catch (e: any) {
      if (!silent) setMsg(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 200);
    }
  }

  useEffect(() => {
    load({ silent: false });
    const t = setInterval(() => load({ silent: true }), REFRESH_SECONDS * 1000);
    return () => clearInterval(t);
  }, [slug]);

  useEffect(() => {
    const t = setInterval(() => {
      setNextRefreshIn((s) => (s <= 1 ? REFRESH_SECONDS : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

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

  const baseRanking = useMemo(() => {
    const rows = summary?.ranking?.length ? summary.ranking : summary?.rows ?? [];
    return rows.slice().sort((a, b) => {
      if (a.overall == null && b.overall == null) return a.blindNumber - b.blindNumber;
      if (a.overall == null) return 1;
      if (b.overall == null) return -1;
      return b.overall - a.overall;
    });
  }, [summary]);

  const filteredRanking = useMemo(() => {
    let rows = baseRanking;

    if (onlyRated) rows = rows.filter((r) => typeof r.overall === "number");
    if (onlyWithImage)
      rows = rows.filter((r) => wineByBlind.get(r.blindNumber)?.imageUrl);

    if (query.trim()) {
      const q = safeStr(query);
      rows = rows.filter((r) => {
        const w = wineByBlind.get(r.blindNumber);
        const hay = [
          `wein ${r.blindNumber}`,
          w?.ownerName,
          w?.winery,
          w?.grape,
          w?.vintage,
        ]
          .map((x) => safeStr(x))
          .join(" ");
        return hay.includes(q);
      });
    }

    if (sortMode === "blind") {
      rows = rows.slice().sort((a, b) => a.blindNumber - b.blindNumber);
    }

    return rows;
  }, [baseRanking, onlyRated, onlyWithImage, query, sortMode, wineByBlind]);

  return (
    <div style={pageStyle}>
      <div style={bgImg} />
      <div style={bgOverlay} />

      <main style={wrapStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={{ margin: 0 }}>🍷 Reporting</h1>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Live · nächstes Update in {nextRefreshIn}s ·{" "}
              {lastUpdatedAt && new Date(lastUpdatedAt).toLocaleTimeString()}
            </div>
          </div>
          <button onClick={() => load({ silent: false })} style={btnStyle}>
            ↻ Refresh
          </button>
        </header>

        {msg && <div style={cardStyle}>{msg}</div>}

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>📊 Ranking</h2>

          {isNarrow ? (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredRanking.map((r, i) => {
                const w = wineByBlind.get(r.blindNumber);
                const isOpen = expanded === r.blindNumber;

                return (
                  <div key={r.blindNumber} style={mobileCard}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <b>
                          #{i + 1} · Wein #{r.blindNumber}
                        </b>
                        <div style={{ opacity: 0.85 }}>{wineLine(w)}</div>
                      </div>
                      <div style={scorePill}>{fmt(r.overall)}</div>
                    </div>

                    <button
                      onClick={() =>
                        setExpanded(isOpen ? null : r.blindNumber)
                      }
                      style={smallBtn}
                    >
                      {isOpen ? "Schließen" : "Details ▾"}
                    </button>

                    <div
                      style={{
                        maxHeight: isOpen ? 400 : 0,
                        overflow: "hidden",
                        transition: "max-height 280ms ease",
                      }}
                    >
                      <div style={{ paddingTop: isOpen ? 12 : 0 }}>
                        {orderedCriteria.map((c) => (
                          <div key={c.id}>
                            {c.label}: {fmt(r.perCrit?.[c.id])}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Wein</th>
                    <th>Overall</th>
                    {orderedCriteria.map((c) => (
                      <th key={c.id}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRanking.map((r, i) => (
                    <tr key={r.blindNumber}>
                      <td>{i + 1}</td>
                      <td>#{r.blindNumber}</td>
                      <td>{fmt(r.overall)}</td>
                      {orderedCriteria.map((c) => (
                        <td key={c.id}>{fmt(r.perCrit?.[c.id])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* FILTER SECTION UNTEN */}
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <b>🔎 Filter</b>
            <button onClick={() => setShowFilters(!showFilters)} style={btnStyle}>
              {showFilters ? "Schließen" : "Öffnen"}
            </button>
          </div>

          <div
            style={{
              maxHeight: showFilters ? 400 : 0,
              overflow: "hidden",
              transition: "max-height 280ms ease",
            }}
          >
            <div style={{ paddingTop: showFilters ? 12 : 0 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suche..."
                style={filterInput}
              />

              <div style={{ marginTop: 10 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={onlyRated}
                    onChange={(e) => setOnlyRated(e.target.checked)}
                  />{" "}
                  Nur bewertete
                </label>
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={onlyWithImage}
                    onChange={(e) => setOnlyWithImage(e.target.checked)}
                  />{" "}
                  Nur mit Bild
                </label>
              </div>

              <div style={{ marginTop: 10 }}>
                <select
                  value={sortMode}
                  onChange={(e) =>
                    setSortMode(e.target.value as "rank" | "blind")
                  }
                >
                  <option value="rank">Sortierung: Ranking</option>
                  <option value="blind">Sortierung: Blindnummer</option>
                </select>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* styles */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  fontFamily: "system-ui",
};

const bgImg: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: "url('/join-bg.jpg')",
  backgroundSize: "cover",
  filter: "blur(2px)",
};

const bgOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
};

const wrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 1000,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 20,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "white",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(20,20,20,0.8)",
  padding: 16,
  borderRadius: 16,
  color: "white",
};

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.1)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.2)",
  cursor: "pointer",
};

const mobileCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "rgba(255,255,255,0.05)",
};

const scorePill: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.1)",
};

const smallBtn: React.CSSProperties = {
  marginTop: 8,
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "white",
  cursor: "pointer",
};

const filterInput: React.CSSProperties = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.4)",
  color: "white",
};
