"use client";

import { useEffect, useMemo, useState } from "react";

type Criterion = { id: string; label: string; order?: number };

type Row = {
  blindNumber: number;
  perCrit: Record<string, number | null>;
  overall: number | null;
};

type Summary = {
  ok: boolean;
  publicSlug: string;
  tastingId: string;
  status: string;
  wineCount: number;
  criteria: Criterion[];
  rows: Row[];
  ranking: Row[];
  ratingCount: number;
  error?: string;
};

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "–";
  return Number(n).toFixed(2).replace(".", ",");
}

export default function ResultsPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const criteria = useMemo(() => {
    const list = data?.criteria ?? [];
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [data?.criteria]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/tasting/summary?publicSlug=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as Summary;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      setData(json);
    } catch (e: any) {
      setData(null);
      setErr(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const winner = data?.ranking?.[0] ?? null;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "28px 16px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>Ergebnis</h1>
          <p style={{ marginTop: 8, marginBottom: 0, color: "#555" }}>
            Tasting: <b>{slug}</b>
            {data?.status ? (
              <>
                {" "}
                · Status: <b>{data.status}</b>
              </>
            ) : null}
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "11px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#eee" : "#111",
            color: loading ? "#111" : "white",
            cursor: loading ? "default" : "pointer",
            height: 44,
            alignSelf: "start",
          }}
        >
          {loading ? "Lade…" : "Neu laden"}
        </button>
      </header>

      {loading ? (
        <div style={{ marginTop: 18, color: "#666" }}>Lade Daten…</div>
      ) : err ? (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 12,
            background: "#fff3f3",
            border: "1px solid #ffd0d0",
            color: "#8a1f1f",
          }}
        >
          <b>Fehler:</b> {err}
        </div>
      ) : !data ? (
        <div style={{ marginTop: 18, color: "#666" }}>Keine Daten.</div>
      ) : (
        <>
          {/* KPI */}
          <section
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
              <div style={{ color: "#666", fontSize: 13 }}>Ratings</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{data.ratingCount ?? 0}</div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
              <div style={{ color: "#666", fontSize: 13 }}>Weine</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{data.wineCount ?? (data.rows?.length ?? 0)}</div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
              <div style={{ color: "#666", fontSize: 13 }}>Sieger</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {winner ? `Wein ${String(winner.blindNumber).padStart(2, "0")}` : "–"}
              </div>
              <div style={{ color: "#444", marginTop: 4 }}>
                Ø {winner ? fmt(winner.overall) : "–"}
              </div>
            </div>
          </section>

          {/* Ranking */}
          <section style={{ marginTop: 26 }}>
            <h2 style={{ margin: "0 0 10px 0" }}>Ranking</h2>

            {data.ranking.length === 0 ? (
              <div style={{ color: "#666" }}>
                Noch keine vollständigen Bewertungen. (Ratings vorhanden: {data.ratingCount})
              </div>
            ) : (
              <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 1fr 120px",
                    padding: "12px 14px",
                    background: "#fafafa",
                    fontWeight: 700,
                  }}
                >
                  <div>#</div>
                  <div>Wein</div>
                  <div style={{ textAlign: "right" }}>Ø Gesamt</div>
                </div>

                {data.ranking.map((r, idx) => (
                  <div
                    key={`rank-${r.blindNumber}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "70px 1fr 120px",
                      padding: "12px 14px",
                      borderTop: "1px solid #f0f0f0",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{idx + 1}</div>
                    <div>{`Wein ${String(r.blindNumber).padStart(2, "0")}`}</div>
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <b>{fmt(r.overall)}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tabelle: alle Weine */}
          <section style={{ marginTop: 26 }}>
            <h2 style={{ margin: "0 0 10px 0" }}>Tabelle</h2>

            <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Wein</th>
                    {criteria.map((c) => (
                      <th
                        key={c.id}
                        style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}
                      >
                        {c.label}
                      </th>
                    ))}
                    <th style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #eee" }}>Ø Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={`row-${r.blindNumber}`} style={{ borderBottom: "1px solid #f4f4f4" }}>
                      <td style={{ padding: 12, fontWeight: 700 }}>
                        {`Wein ${String(r.blindNumber).padStart(2, "0")}`}
                      </td>
                      {criteria.map((c) => (
                        <td
                          key={`${r.blindNumber}-${c.id}`}
                          style={{
                            padding: 12,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: r.perCrit?.[c.label] == null ? "#999" : "#111",
                          }}
                        >
                          {fmt(r.perCrit?.[c.label])}
                        </td>
                      ))}
                      <td style={{ padding: 12, textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(r.overall)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
              Hinweis: Weine ohne Bewertungen bleiben „–“. Sobald mehr Teilnehmer bewerten, füllt sich das Ranking automatisch.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
