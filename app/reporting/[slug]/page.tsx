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
  status: string | null;
  wineCount: number;
  criteria: { id: string; label: string; order: number }[];
  rows: SummaryRow[];
  ranking: SummaryRow[];
  ratingCount: number;
};

type Wine = {
  blindNumber: number | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;
  ownerName: string | null;
  imageUrl?: string | null;
};

export default function ReportingPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug;

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const [sRes, wRes] = await Promise.all([
      fetch(`/api/tasting/summary?publicSlug=${slug}`, { cache: "no-store" }),
      fetch(`/api/tasting/wines?publicSlug=${slug}`, { cache: "no-store" }),
    ]);

    const sJson = await sRes.json();
    const wJson = await wRes.json();

    setSummary(sJson);
    setWines(wJson?.wines ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const wineMap = useMemo(() => {
    const m = new Map<number, Wine>();
    for (const w of wines) {
      if (typeof w.blindNumber === "number") {
        m.set(w.blindNumber, w);
      }
    }
    return m;
  }, [wines]);

  const ranking = useMemo(() => {
    return (summary?.ranking ?? [])
      .slice()
      .sort((a, b) => {
        if (a.overall == null) return 1;
        if (b.overall == null) return -1;
        return b.overall - a.overall;
      });
  }, [summary]);

  if (loading) {
    return <div style={{ padding: 40 }}>Lade…</div>;
  }

  return (
    <div style={{ padding: 30, background: "#111", minHeight: "100vh", color: "white" }}>
      <h1>🍷 Reporting</h1>
      <p>Runde: {slug}</p>

      <h2>🏆 Top 3</h2>
      {ranking.slice(0, 3).map((r, i) => {
        const w = wineMap.get(r.blindNumber);
        return (
          <div key={r.blindNumber} style={{ marginBottom: 12 }}>
            #{i + 1} · Wein #{r.blindNumber} ·{" "}
            <strong>{r.overall?.toFixed(2) ?? "—"}</strong>
            <div>
              {w?.winery} {w?.grape} {w?.vintage}
            </div>
          </div>
        );
      })}

      <h2>📊 Ranking</h2>
      {ranking.map((r, i) => {
        const w = wineMap.get(r.blindNumber);
        return (
          <div key={r.blindNumber} style={{ padding: 6 }}>
            #{i + 1} · Wein #{r.blindNumber} ·{" "}
            <strong>{r.overall?.toFixed(2) ?? "—"}</strong> · {w?.ownerName ?? "—"}
          </div>
        );
      })}
    </div>
  );
}
