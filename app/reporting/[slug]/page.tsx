// app/reporting/[slug]/page.tsx
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

function fmt(v: number | null, digits = 2) {
  if (v === null || typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function emojiRank(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "🏅";
}

function wineTitle(w: WineSlotPublic | undefined, fallbackBlind: number) {
  const parts = [w?.winery, w?.grape, w?.vintage].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return `Wein #${fallbackBlind}`;
}

export default function ReportingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug || "");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // UI state
  const [expandedBlind, setExpandedBlind] = useState<number | null>(null);
  const [tvMode, setTvMode] = useState(false);

  // ✅ Filter (unten + zugeklappt)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [onlyRated, setOnlyRated] = useState(false);
  const [minOverall, setMinOverall] = useState<string>("");
  const [search, setSearch] = useState("");

  // live indicator
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const timerRef = useRef<number | null>(null);

  // restore TV mode preference
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("WF_TV_MODE");
      if (saved === "1") setTvMode(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("WF_TV_MODE", tvMode ? "1" : "0");
    } catch {}
  }, [tvMode]);

  async function load() {
    setMsg(null);
    setIsRefreshing(true);
    setLoading((prev) => prev && !summary); // first load shows loader card

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
      setLastUpdatedAt(Date.now());
    } catch (e: any) {
      setMsg(e?.message ?? "Load failed");
      setSummary(null);
      setWines(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(load, 10_000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
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

  // Top3: bewusst UNGEFILTERT (wie “zuvor beibehalten”)
  const top3 = useMemo(() => baseRanking.slice(0, 3), [baseRanking]);

  // score bar range (1–10)
  const scoreMin = 1;
  const scoreMax = 10;
  function barWidth(score: number | null) {
    if (score == null || !Number.isFinite(score)) return "0%";
    const t = (score - scoreMin) / (scoreMax - scoreMin);
    return `${Math.round(clamp01(t) * 100)}%`;
  }

  const hasAnyFilter = useMemo(() => {
    return onlyRated || minOverall.trim() !== "" || search.trim() !== "";
  }, [onlyRated, minOverall, search]);

  const filteredRanking = useMemo(() => {
    let rows = baseRanking.slice();

    if (onlyRated) rows = rows.filter((r) => typeof r.overall === "number");

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
  }, [baseRanking, onlyRated, minOverall, search, wineByBlind]);

  function resetFilters() {
    setOnlyRated(false);
    setMinOverall("");
    setSearch("");
  }

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdatedAt) return "—";
    const d = new Date(lastUpdatedAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [lastUpdatedAt]);

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
          filter: "blur(3px)",
          transform: "scale(1.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.78) 55%, rgba(0,0,0,0.90) 100%)",
        }}
      />

      <main style={{ ...wrapStyle, maxWidth: tvMode ? 1400 : 1180 }}>
        {/* HEADER */}
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: tvMode ? 30 : 26 }}>🍷 Reporting</h1>
              <span style={slugBadge}>{slug}</span>
            </div>

            <div style={{ opacity: 0.78, fontSize: tvMode ? 14 : 13 }}>
              Runde: <b>{slug}</b> · Status: <b>{summary?.status ?? "—"}</b> · Ratings:{" "}
              <b>{summary?.ratingCount ?? "—"}</b> · Auto-Refresh: <b>10s</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <a href={`/join?slug=${enc(slug)}`} target="_blank" rel="noreferrer" style={headerBtnPrimary}>
              Join ↗
            </a>

            <button onClick={load} style={headerBtn}>
              ↻ Refresh
            </button>

            <button onClick={() => setTvMode((v) => !v)} style={headerBtn}>
              {tvMode ? "TV-Mode aus" : "TV-Mode an"}
            </button>
          </div>
        </header>

        {/* Live indicator */}
        <div style={liveRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                ...liveDot,
                opacity: isRefreshing ? 1 : 0.85,
                transform: isRefreshing ? "scale(1.05)" : "scale(1)",
              }}
            />
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {isRefreshing ? (
                <span>Aktualisiere…</span>
              ) : (
                <span>
                  Letztes Update: <b>{lastUpdatedText}</b>
                </span>
              )}
            </div>
          </div>

          {msg ? <div style={errorInline}>{msg}</div> : <div style={{ fontSize: 12, opacity: 0.7 }}>Live aus aktuellen Ratings</div>}
        </div>

        {loading && !summary && (
          <div style={cardStyle}>
            <p style={{ margin: 0, opacity: 0.85 }}>Lade…</p>
          </div>
        )}

        {summary && (
          <>
            {/* TOP 3 */}
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🏆</span>
                  <h2 style={{ margin: 0, fontSize: tvMode ? 18 : 16 }}>Top 3</h2>
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Live aus aktuellen Ratings</div>
              </div>

              {top3.length === 0 ? (
                <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>Noch keine Bewertungen.</div>
              ) : (
                <div style={top3Grid}>
                  {top3.map((r, idx) => {
                    const w = wineByBlind.get(r.blindNumber);
                    const score = r.overall;
                    return (
                      <div key={r.blindNumber} style={topCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 16 }}>{emojiRank(idx)}</span>
                              <div style={{ fontWeight: 950 }}>Platz {idx + 1}</div>
                            </div>

                            <div style={{ marginTop: 8, fontWeight: 900, fontSize: 14 }}>
                              Wein #{r.blindNumber} · {w?.ownerName ?? "—"}
                            </div>

                            <div style={{ marginTop: 4, opacity: 0.85, fontSize: 13 }}>
                              — {wineTitle(w, r.blindNumber)}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>Ø Score</div>
                            <div style={scoreBadgeBig}>{fmt(score, 2)}</div>
                          </div>
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <div style={barTrack}>
                            <div style={{ ...barFill, width: barWidth(score) }} />
                          </div>
                        </div>

                        {/* criteria pills (max 4 like screenshot) */}
                        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {orderedCriteria.slice(0, 4).map((c) => {
                            const v = r.perCrit?.[c.id] ?? null;
                            return (
                              <div key={c.id} style={pill}>
                                <span style={{ opacity: 0.8 }}>{c.label}</span>
                                <span style={{ fontWeight: 950 }}>{fmt(v, 1)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* RANKING */}
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>📊</span>
                  <h2 style={{ margin: 0, fontSize: tvMode ? 18 : 16 }}>Ranking</h2>
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Score-Bar: 1–10</div>
              </div>

              {/* active filter hint (optional small line) */}
              {hasAnyFilter && (
                <div style={filterInfoBar}>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    Filter aktiv · Zeilen: <b>{filteredRanking.length}</b>
                  </div>
                  <button onClick={resetFilters} style={filterResetBtnSmall}>
                    Filter zurücksetzen
                  </button>
                </div>
              )}

              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                  <thead>
                    <tr style={{ opacity: 0.9 }}>
                      <th style={th}>#</th>
                      <th style={th}>Wein</th>
                      <th style={th}>Δ</th>
                      <th style={thRight}>Ø</th>
                      <th style={th}>Bar</th>
                      {orderedCriteria.map((c) => (
                        <th key={c.id} style={thRight}>
                          {c.label}
                        </th>
                      ))}
                      <th style={thRight}>Owner</th>
                      <th style={th}>Aktion</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRanking.map((r, idx) => {
                      const w = wineByBlind.get(r.blindNumber);
                      const isOpen = expandedBlind === r.blindNumber;
                      const score = r.overall;

                      return (
                        <>
                          <tr key={r.blindNumber} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                            <td style={td}>{idx + 1}</td>

                            <td style={td}>
                              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                <div style={thumbWrap}>
                                  {w?.imageUrl ? (
                                    <img src={w.imageUrl} alt="Flasche" style={thumbImg} />
                                  ) : (
                                    <div style={thumbEmpty}> </div>
                                  )}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 950, display: "flex", gap: 10, alignItems: "baseline" }}>
                                    <span>Wein #{r.blindNumber}</span>
                                    <span style={{ opacity: 0.75, fontWeight: 800 }}>
                                      {w?.winery ? `— ${w.winery}` : "(blind)"}
                                    </span>
                                  </div>
                                  <div style={{ opacity: 0.82, fontSize: 13 }}>
                                    — {wineTitle(w, r.blindNumber)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Δ column – kept as placeholder like screenshot */}
                            <td style={tdCenter}>
                              <span style={deltaPill}>—</span>
                            </td>

                            <td style={tdRight}>
                              <span style={{ ...scoreBadge, opacity: score == null ? 0.6 : 1 }}>{fmt(score, 2)}</span>
                            </td>

                            <td style={td}>
                              <div style={barTrackSmall}>
                                <div style={{ ...barFill, width: barWidth(score) }} />
                              </div>
                            </td>

                            {orderedCriteria.map((c) => (
                              <td key={c.id} style={tdRight}>
                                {fmt(r.perCrit?.[c.id] ?? null, 2)}
                              </td>
                            ))}

                            <td style={tdRight}>{w?.ownerName ?? "—"}</td>

                            <td style={td}>
                              <button
                                onClick={() => setExpandedBlind(isOpen ? null : r.blindNumber)}
                                style={smallBtn}
                              >
                                {isOpen ? "Details" : "Details"}
                              </button>

                              <a
                                href={`/t/${enc(slug)}/wine/${r.blindNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                style={smallLink}
                              >
                                Bewertung ↗
                              </a>
                            </td>
                          </tr>

                          {isOpen && (
                            <tr key={`${r.blindNumber}-details`}>
                              <td style={{ ...td, paddingTop: 0 }} />
                              <td colSpan={7} style={{ ...td, paddingTop: 0 }}>
                                <div style={detailsBox}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                    <div style={{ fontWeight: 950 }}>Details · Wein #{r.blindNumber}</div>
                                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                                      Tap “Details” zum Schließen
                                    </div>
                                  </div>

                                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                      {orderedCriteria.map((c) => {
                                        const v = r.perCrit?.[c.id] ?? null;
                                        return (
                                          <div key={c.id} style={pill}>
                                            <span style={{ opacity: 0.8 }}>{c.label}</span>
                                            <span style={{ fontWeight: 950 }}>{fmt(v, 2)}</span>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
                                      <div style={{ flex: "1 1 320px" }}>
                                        <div style={{ opacity: 0.85, fontSize: 13 }}>
                                          <b>Wein</b>: {wineTitle(w, r.blindNumber)}
                                        </div>
                                        <div style={{ opacity: 0.75, fontSize: 13, marginTop: 6 }}>
                                          <b>Owner</b>: {w?.ownerName ?? "—"}
                                        </div>
                                      </div>

                                      <div style={{ width: 140 }}>
                                        <div style={{ opacity: 0.7, fontSize: 12 }}>Ø Score</div>
                                        <div style={scoreBadgeBig}>{fmt(score, 2)}</div>
                                        <div style={{ marginTop: 10 }}>
                                          <div style={barTrack}>
                                            <div style={{ ...barFill, width: barWidth(score) }} />
                                          </div>
                                        </div>
                                      </div>

                                      <div style={{ width: 220 }}>
                                        {w?.imageUrl ? (
                                          <img
                                            src={w.imageUrl}
                                            alt="Flasche"
                                            style={{
                                              width: "100%",
                                              height: 140,
                                              objectFit: "cover",
                                              borderRadius: 14,
                                              border: "1px solid rgba(255,255,255,0.14)",
                                            }}
                                          />
                                        ) : (
                                          <div
                                            style={{
                                              width: "100%",
                                              height: 140,
                                              borderRadius: 14,
                                              border: "1px solid rgba(255,255,255,0.14)",
                                              background: "rgba(255,255,255,0.06)",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              opacity: 0.7,
                                            }}
                                          >
                                            Kein Bild
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ ...td, paddingTop: 0 }} />
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                Tap “Details” für Kriterien-Ø + Bild
              </div>
            </section>

            {/* ✅ FILTER ganz unten, standardmäßig zugeklappt */}
            <section style={cardStyle}>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                style={filterToggleBtn}
                aria-expanded={filtersOpen}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 950 }}>Filter</span>
                  {hasAnyFilter ? <span style={filterActivePill}>aktiv</span> : <span style={filterInactivePill}>aus</span>}
                </span>

                <span style={{ opacity: 0.85, fontWeight: 900 }}>{filtersOpen ? "▲" : "▼"}</span>
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
                      <input type="checkbox" checked={onlyRated} onChange={(e) => setOnlyRated(e.target.checked)} />
                      nur bewertete Weine
                    </label>
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
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

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" onClick={resetFilters} style={resetBtn}>
                      Filter zurücksetzen
                    </button>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      Zeilen nach Filter: <b>{filteredRanking.length}</b>
                    </div>
                  </div>

                  <p style={{ margin: 0, opacity: 0.65, fontSize: 12 }}>
                    Hinweis: Filter wirkt nur auf die Anzeige (Top-3 bleibt unverändert).
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

/* =========================
   STYLES
========================= */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
};

const wrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(20,20,20,0.72)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 18,
  padding: 18,
  color: "white",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
  color: "white",
};

const slugBadge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.95,
};

const headerBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const headerBtnPrimary: React.CSSProperties = {
  ...headerBtn,
  textDecoration: "none",
  display: "inline-block",
  background: "linear-gradient(135deg, rgba(142,14,0,0.95), rgba(192,57,43,0.95))",
  border: "1px solid rgba(255,255,255,0.10)",
};

const liveRow: React.CSSProperties = {
  marginTop: -6,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  padding: "0 4px",
  color: "white",
};

const liveDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "rgba(255,120,80,0.95)",
  boxShadow: "0 0 0 6px rgba(255,120,80,0.10)",
  transition: "transform 160ms ease, opacity 160ms ease",
};

const errorInline: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
  color: "#ffb4b4",
  fontSize: 12,
  fontWeight: 800,
};

const top3Grid: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const topCard: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  padding: 14,
  minHeight: 140,
};

const scoreBadgeBig: React.CSSProperties = {
  marginTop: 6,
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(255,160,60,0.20)",
  border: "1px solid rgba(255,160,60,0.28)",
  color: "#ffb050",
  fontWeight: 950,
  fontSize: 22,
  letterSpacing: 0.2,
  fontVariantNumeric: "tabular-nums",
  minWidth: 86,
  textAlign: "right",
};

const scoreBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  fontWeight: 950,
  fontVariantNumeric: "tabular-nums",
  minWidth: 80,
  textAlign: "right",
};

const barTrack: React.CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  overflow: "hidden",
};

const barTrackSmall: React.CSSProperties = {
  ...barTrack,
  height: 8,
  width: 120,
};

const barFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(255,60,80,0.95), rgba(255,180,60,0.95))",
};

const pill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const th: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.16)",
  fontSize: 12,
  letterSpacing: 0.2,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const thRight: React.CSSProperties = { ...th, textAlign: "right" };

const td: React.CSSProperties = {
  padding: "12px 10px",
  verticalAlign: "top",
  fontSize: 14,
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const tdCenter: React.CSSProperties = {
  ...td,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const thumbWrap: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
  flex: "0 0 auto",
};

const thumbImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const thumbEmpty: React.CSSProperties = {
  width: "100%",
  height: "100%",
  opacity: 0.5,
};

const deltaPill: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 900,
  opacity: 0.85,
  minWidth: 54,
};

const smallBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  marginRight: 10,
};

const smallLink: React.CSSProperties = {
  color: "white",
  opacity: 0.95,
  textDecoration: "underline",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const detailsBox: React.CSSProperties = {
  marginTop: 10,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const filterInfoBar: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const filterResetBtnSmall: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 12,
};

/* ✅ Filter UI (unten, zugeklappt) */
const filterToggleBtn: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 12px",
  borderRadius: 14,
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
  fontWeight: 950,
};

const filterInactivePill: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  fontWeight: 900,
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
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(0,0,0,0.20)",
  color: "white",
  outline: "none",
};

const resetBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

/* Mobile responsiveness */
const mq = typeof window !== "undefined" ? window.matchMedia : null;
if (mq) {
  // no-op (kept empty on purpose)
}
