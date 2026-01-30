export const dynamic = "force-dynamic";

type Summary = {
  ok: boolean;
  publicSlug: string;
  tastingId: string;
  status: "draft" | "open" | "closed" | "revealed" | string;
  wineCount: number;
  criteria: { id: string; label: string; order?: number }[];
  rows?: { blindNumber: number; perCrit: Record<string, number | null>; overall: number | null }[];
  ranking?: { blindNumber: number; perCrit: Record<string, number | null>; overall: number | null }[];
  ratingCount?: number;
  message?: string;
  error?: string;
};

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2);
}

export default async function ResultsPage({ params }: { params: { slug: string } }) {
  const slug = (params.slug ?? "").trim();

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/tasting/summary?publicSlug=${encodeURIComponent(slug)}`, {
    cache: "no-store",
  }).catch(() => null);

  // If NEXT_PUBLIC_BASE_URL is not set, fall back to relative fetch (works on Vercel)
  const data: Summary =
    res
      ? await res.json().catch(() => ({ ok: false, error: "Invalid JSON from API" } as any))
      : await fetch(`/api/tasting/summary?publicSlug=${encodeURIComponent(slug)}`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ ok: false, error: "Fetch failed" } as any));

  if (!data?.ok) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 980 }}>
        <h1>Ergebnisse</h1>
        <p style={{ color: "crimson" }}>
          {data?.error ?? "Konnte Summary nicht laden."}
        </p>
      </main>
    );
  }

  const criteria = data.criteria ?? [];
  const rows = data.rows ?? [];
  const ranking = data.ranking ?? [];

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 980 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Ergebnisse · {data.publicSlug}</h1>
          <p style={{ marginTop: 0, opacity: 0.75 }}>
            Status: <b>{data.status}</b> · Ratings: <b>{data.ratingCount ?? 0}</b>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={`/t/${encodeURIComponent(slug)}`}
            style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, textDecoration: "none" }}
          >
            ↩︎ Zur Tasting-Seite
          </a>
          <a
            href={`/t/${encodeURIComponent(slug)}/results`}
            style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, textDecoration: "none" }}
          >
            🔄 Refresh
          </a>
        </div>
      </header>

      {data.status !== "revealed" && (
        <section style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "rgba(255,193,7,0.2)" }}>
          <b>Noch nicht aufgedeckt.</b>
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            Sobald du den Status auf <code>revealed</code> setzt (Reveal-Endpoint), erscheinen hier Ranking & Auswertung.
          </div>
        </section>
      )}

      {data.status === "revealed" && (
        <>
          {/* Ranking */}
          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>🏆 Ranking (nach Gesamtschnitt)</h2>

            {ranking.length === 0 ? (
              <p style={{ opacity: 0.8 }}>Noch keine vollständigen Ratings gefunden.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {ranking.map((r, idx) => (
                  <li key={r.blindNumber} style={{ marginBottom: 6 }}>
                    <b>Wein {r.blindNumber}</b> – Gesamtschnitt: <b>{fmt(r.overall)}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Detail-Tabelle */}
          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>📊 Detail (Ø pro Kriterium)</h2>

            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>Wein</th>
                    {criteria.map((c) => (
                      <th key={c.id} style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        {c.label}
                      </th>
                    ))}
                    <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      Gesamt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.blindNumber}>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                        <b>{r.blindNumber}</b>
                      </td>
                      {criteria.map((c) => (
                        <td key={c.id} style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                          {fmt(r.perCrit?.[c.label])}
                        </td>
                      ))}
                      <td style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                        <b>{fmt(r.overall)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Hinweis: Wenn Werte als „—“ erscheinen, fehlen für dieses Kriterium/Wein noch Ratings oder das Rating-Format passt nicht zu den erkannten Feldern (<code>scores</code>/<code>ratings</code>/<code>values</code>).
            </p>
          </section>
        </>
      )}
    </main>
  );
}
