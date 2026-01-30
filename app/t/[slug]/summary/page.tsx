"use client";

import { useEffect, useState } from "react";

export default function SummaryPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tasting/summary?slug=${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Load failed");
        setData(json);
      } catch (e: any) {
        setErr(e?.message ?? "Fehler");
      }
    })();
  }, [slug]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <a href={`/t/${encodeURIComponent(slug)}`} style={{ display: "inline-block", marginBottom: 12 }}>
        ← zurück
      </a>

      <h1>Ergebnis</h1>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!data && !err && <p>Lade...</p>}

      {data && (
        <>
          <p style={{ opacity: 0.8 }}>
            {data.tasting.title} · {data.tasting.hostName}
          </p>

          <ol>
            {data.ranking.map((r: any) => (
              <li key={r.wineId} style={{ marginBottom: 10 }}>
                <strong>Wein #{r.blindNumber}</strong>{" "}
                {r.displayName ? `— ${r.displayName}` : ""}
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Ø Gesamt: {r.avgTotal ?? "–"} (n={r.count})
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
