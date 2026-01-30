"use client";

import { useEffect, useState } from "react";

type PublicData = {
  tasting: { id: string; title: string; hostName: string; status: string; wineCount: number };
  criteria: { id: string; label: string; scaleMin: number; scaleMax: number; order: number }[];
  wines: { id: string; blindNumber: number; isActive: boolean; displayName?: string | null }[];
};

export default function TastingPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);

  const [data, setData] = useState<PublicData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const res = await fetch(`/api/tasting/public?slug=${encodeURIComponent(slug)}`);
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
      <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>← Start</a>

      <h1 style={{ marginBottom: 6 }}>Tasting</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>Slug: <code>{slug}</code></p>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!data && !err && <p>Lade...</p>}

      {data && (
        <>
          <h2 style={{ marginTop: 18, marginBottom: 6 }}>{data.tasting.title}</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            Gastgeber: {data.tasting.hostName} · Status: {data.tasting.status}
          </p>

          <h3 style={{ marginTop: 18 }}>Weine</h3>
          <ul>
            {data.wines
              .filter((w) => w.isActive !== false)
              .map((w) => (
                <li key={w.id} style={{ marginBottom: 8 }}>
                  <strong>Wein #{w.blindNumber}</strong>{" "}
                  {data.tasting.status === "revealed" && w.displayName ? `— ${w.displayName}` : ""}
                  {"  "}
                  <a href={`/t/${encodeURIComponent(slug)}/wine/${w.blindNumber}`}>bewerten</a>
                </li>
              ))}
          </ul>

          <h3 style={{ marginTop: 18 }}>Kriterien</h3>
          <ul>
            {data.criteria.map((c) => (
              <li key={c.id}>
                {c.label} ({c.scaleMin}–{c.scaleMax})
              </li>
            ))}
          </ul>

          {data.tasting.status === "revealed" && (
            <p style={{ marginTop: 18 }}>
              <a href={`/t/${encodeURIComponent(slug)}/summary`}>→ Ergebnis ansehen</a>
            </p>
          )}
        </>
      )}
    </main>
  );
}
