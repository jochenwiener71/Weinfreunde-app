"use client";

import { useEffect, useMemo, useState } from "react";

type Criterion = { id: string; label: string; order: number };

type SummaryRow = {
  blindNumber: number;
  perCrit: Record<string, number | null>;
  overall: number | null;
};

type SummaryResponse = {
  ok: boolean;
  publicSlug: string;
  tastingId: string;
  status: string | null;
  wineCount: number;
  criteria: Criterion[];
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
};

type WinesResponse = {
  ok: boolean;
  publicSlug: string;
  tastingId: string;
  status: string;
  wineCount: number;
  wines: WineSlotPublic[];
};

function sortKeyServeOrBlind(w: { serveOrder: number | null; blindNumber: number | null }) {
  // if serveOrder set -> primary
  if (typeof w.serveOrder === "number") return w.serveOrder * 1000 + (w.blindNumber ?? 999);
  // else fallback to blindNumber
  return 999_000 + (w.blindNumber ?? 999);
}

function sortKeyBlindOnly(blindNumber: number | null) {
  return blindNumber ?? 999;
}

export default function TastingResultPage({ params }: { params: { slug: string } }) {
  const publicSlug = decodeURIComponent(params.slug);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<WinesResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // admin UI gating
  const [adminMode, setAdminMode] = useState(false);

  // optional admin controls
  const [adminSecret, setAdminSecret] = useState("");
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  async function fetchAll() {
    setErr(null);
    try {
      const [sRes, wRes] = await Promise.all([
        fetch(`/api/tasting/summary?publicSlug=${encodeURIComponent(publicSlug)}`, { cache: "no-store" }),
        fetch(`/api/tasting/wines?publicSlug=${encodeURIComponent(publicSlug)}`, { cache: "no-store" }),
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
      setErr(e?.message ?? "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  // auto refresh (polling) + adminMode via ?admin=1
  useEffect(() => {
    // admin mode only if URL contains ?admin=1
    try {
      const sp = new URLSearchParams(window.location.search);
      setAdminMode(sp.get("admin") === "1");
    } catch {
      setAdminMode(false);
    }

    let alive = true;

    (async () => {
      if (!alive) return;
      await fetchAll();
    })();

    const id = window.setInterval(() => {
      fetchAll();
    }, 3000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicSlug]);

  const criteriaLabels = useMemo(() => {
    return (summary?.criteria ?? []).map((c) => c.label);
  }, [summary]);

  const winesByBlind = useMemo(() => {
    const map = new Map<number, WineSlotPublic>();
    for (const w of wines?.wines ?? []) {
      if (typeof w.blindNumber === "number") map.set(w.blindNumber, w);
    }
    return map;
  }, [wines]);

  const revealed = useMemo(() => {
    const s = String(summary?.status ?? wines?.status ?? "").toLowerCase();
    return s === "revealed";
  }, [summary, wines]);

  const statusText = useMemo(() => {
    const s = String(summary?.status ?? wines?.status ?? "").trim();
    return s || "unknown";
  }, [summary, wines]);

  // Do we have any serveOrder at all?
  const hasServeOrder = useMemo(() => {
    return (wines?.wines ?? []).some((w) => typeof w.serveOrder === "number");
  }, [wines]);

  // For "Alle Weine" table, we want ordering by serveOrder if present, otherwise blindNumber
  const rowsOrderedForDisplay = useMemo(() => {
    const rows = (summary?.rows ?? []).slice();

    if (!rows.length) return rows;

    if (!hasServeOrder) {
      return rows.sort((a, b) => sortKeyBlindOnly(a.blindNumber) - sortKeyBlindOnly(b.blindNumber));
    }

    // Build mapping blindNumber -> serveOrder for sorting
    const serveByBlind = new Map<number, number>();
    for (const w of wines?.wines ?? []) {
      if (typeof w.blindNumber === "number" && typeof w.serveOrder === "number") {
        serveByBlind.set(w.blindNumber, w.serveOrder);
      }
    }

    return rows.sort((a, b) => {
      const aServe = serveByBlind.get(a.blindNumber) ?? null;
      const bServe = serveByBlind.get(b.blindNumber) ?? null;

      const aKey = sortKeyServeOrBlind({ serveOrder: aServe, blindNumber: a.blindNumber });
      const bKey = sortKeyServeOrBlind({ serveOrder: bServe, blindNumber: b.blindNumber });

      return aKey - bKey;
    });
  }, [summary, wines, hasServeOrder]);

  async function setStatus(nextStatus: "open" | "revealed" | "closed" | "draft") {
    setAdminMsg(null);
    setAdminLoading(true);
    try {
      const res = await fetch("/api/admin/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          publicSlug,
          status: nextStatus,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setAdminMsg(`Status gesetzt: ${nextStatus} ✅`);
      await fetchAll(); // sofort aktualisieren
    } catch (e: any) {
      setAdminMsg(e?.message ?? "Admin-Fehler");
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ergebnisse · {publicSlug}</h1>
          <p style={{ margin: "6px 0 0 0", opacity: 0.75 }}>
            Status: <b>{statusText}</b> · Ratings: <b>{summary?.ratingCount ?? "—"}</b>{" "}
            <span style={{ opacity: 0.7 }}>(Auto-Refresh alle 3s)</span>
          </p>
          {hasServeOrder && (
            <p style={{ margin: "6px 0 0 0", fontSize: 12, opacity: 0.7 }}>
              Anzeige ist nach <b>Serve-Order</b> sortiert (wenn gesetzt), sonst nach Blindnummer.
            </p>
          )}
        </div>

        <button
          onClick={fetchAll}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
        >
          Jetzt aktualisieren
        </button>
      </header>

      {loading && <p style={{ marginTop: 16 }}>Lade…</p>}
      {err && (
        <p style={{ marginTop: 16, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </p>
      )}

      {/* ADMIN CONTROLS (hidden unless ?admin=1) */}
      {adminMode && (
        <section style={{ marginTop: 18, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Admin</h2>
          <p style={{ margin: "6px 0 12px 0", opacity: 0.75 }}>
            Reveal direkt auslösen. (Admin sichtbar, weil URL <code>?admin=1</code> enthält.)
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 10 }}>
            <input
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="ADMIN_SECRET"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
            />

            <button
              onClick={() => setStatus("draft")}
              disabled={!adminSecret.trim() || adminLoading}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
            >
              Draft
            </button>

            <button
              onClick={() => setStatus("open")}
              disabled={!adminSecret.trim() || adminLoading}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
            >
              Open
            </button>

            <button
              onClick={() => setStatus("closed")}
              disabled={!adminSecret.trim() || adminLoading}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
            >
              Closed
            </button>

            <button
              onClick={() => setStatus("revealed")}
              disabled={!adminSecret.trim() || adminLoading}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
            >
              Reveal
            </button>
          </div>

          {adminMsg && (
            <p style={{ marginTop: 10, color: adminMsg.includes("✅") ? "inherit" : "crimson", whiteSpace: "pre-wrap" }}>
              {adminMsg}
            </p>
          )}

          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Tipp: Ohne <code>?admin=1</code> wird dieser Admin-Block gar nicht gerendert (Teilnehmer sehen ihn nicht).
          </p>
        </section>
      )}

      {/* RANKING */}
      {!!summary && (
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Ranking (nach Ø Gesamt)</h2>

          {summary.ranking?.length ? (
            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                    <th style={{ textAlign: "left", padding: 10 }}>#</th>
                    <th style={{ textAlign: "left", padding: 10 }}>Wein</th>
                    {criteriaLabels.map((label) => (
                      <th key={label} style={{ textAlign: "right", padding: 10 }}>{label}</th>
                    ))}
                    <th style={{ textAlign: "right", padding: 10 }}>Ø Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.ranking.map((r, idx) => {
                    const w = winesByBlind.get(r.blindNumber);

                    const wineTitle = revealed
                      ? [
                          w?.ownerName ? `(${w.ownerName})` : null,
                          w?.winery ?? null,
                          w?.grape ?? null,
                          w?.vintage ?? null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || `Wein ${r.blindNumber}`
                      : `Wein ${r.blindNumber}`;

                    return (
                      <tr key={r.blindNumber} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                        <td style={{ padding: 10, width: 40 }}>{idx + 1}</td>
                        <td style={{ padding: 10 }}>
                          <b>{r.blindNumber}</b>{" "}
                          <span style={{ opacity: 0.85, marginLeft: 6 }}>{wineTitle}</span>
                        </td>

                        {criteriaLabels.map((label) => (
                          <td key={label} style={{ padding: 10, textAlign: "right" }}>
                            {r.perCrit?.[label] ?? "—"}
                          </td>
                        ))}

                        <td style={{ padding: 10, textAlign: "right" }}>
                          <b>{r.overall ?? "—"}</b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ opacity: 0.75 }}>Noch kein Ranking (keine Durchschnittswerte vorhanden).</p>
          )}
        </section>
      )}

      {/* ALLE WEINE */}
      {!!summary && (
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>
            Alle Weine {hasServeOrder ? "(Sortierung: Serve-Order)" : "(Sortierung: Blindnummer)"}
          </h2>

          <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                  <th style={{ textAlign: "left", padding: 10, width: 90 }}>Blind #</th>
                  {hasServeOrder && <th style={{ textAlign: "right", padding: 10, width: 90 }}>Serve</th>}
                  <th style={{ textAlign: "left", padding: 10 }}>Details (nach Reveal)</th>
                  {criteriaLabels.map((label) => (
                    <th key={label} style={{ textAlign: "right", padding: 10 }}>{label}</th>
                  ))}
                  <th style={{ textAlign: "right", padding: 10 }}>Ø Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {rowsOrderedForDisplay.map((r) => {
                  const w = winesByBlind.get(r.blindNumber);

                  const details = revealed
                    ? [
                        w?.ownerName ? `Owner: ${w.ownerName}` : null,
                        w?.winery ? `Weingut: ${w.winery}` : null,
                        w?.grape ? `Rebsorte: ${w.grape}` : null,
                        w?.vintage ? `Jahrgang: ${w.vintage}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "—";

                  return (
                    <tr key={r.blindNumber} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                      <td style={{ padding: 10 }}>
                        <b>{r.blindNumber}</b>
                      </td>

                      {hasServeOrder && (
                        <td style={{ padding: 10, textAlign: "right" }}>
                          {typeof w?.serveOrder === "number" ? w.serveOrder : "—"}
                        </td>
                      )}

                      <td style={{ padding: 10, opacity: revealed ? 0.9 : 0.6 }}>
                        {details || "—"}
                      </td>

                      {criteriaLabels.map((label) => (
                        <td key={label} style={{ padding: 10, textAlign: "right" }}>
                          {r.perCrit?.[label] ?? "—"}
                        </td>
                      ))}

                      <td style={{ padding: 10, textAlign: "right" }}>
                        <b>{r.overall ?? "—"}</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Hinweis: Weindetails erscheinen nur nach <b>Reveal</b>. Serve-Order ist optional und wird nur angezeigt, wenn mindestens
            ein Wein eine Serve-Order hat.
          </p>
        </section>
      )}
    </main>
  );
}
