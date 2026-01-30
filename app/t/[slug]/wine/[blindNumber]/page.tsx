"use client";

import { useEffect, useMemo, useState } from "react";

type PublicData = {
  tasting: { title: string; hostName: string; status: string };
  criteria: { id: string; label: string; scaleMin: number; scaleMax: number; order: number }[];
};

export default function WineRatePage({
  params,
}: {
  params: { slug: string; blindNumber: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const blindNumber = Number(params.blindNumber);

  const [data, setData] = useState<PublicData | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/tasting/public?slug=${encodeURIComponent(slug)}`);
      const json = await res.json();
      if (res.ok) setData({ tasting: json.tasting, criteria: json.criteria });
      else setMsg(json?.error ?? "Load failed");
    })();
  }, [slug]);

  const orderedCriteria = useMemo(
    () => (data?.criteria ?? []).slice().sort((a, b) => a.order - b.order),
    [data]
  );

  async function save() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rating/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, blindNumber, scores, comment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      setMsg("Gespeichert ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <a href={`/t/${encodeURIComponent(slug)}`} style={{ display: "inline-block", marginBottom: 12 }}>
        ← zurück
      </a>

      <h1 style={{ marginBottom: 6 }}>Wein #{blindNumber} bewerten</h1>
      {data && (
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          {data.tasting.title} · {data.tasting.hostName}
        </p>
      )}

      {!data && <p>Lade...</p>}

      {orderedCriteria.map((c) => (
        <div key={c.id} style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 6 }}>
            <strong>{c.label}</strong> ({c.scaleMin}–{c.scaleMax})
          </div>
          <input
            type="range"
            min={c.scaleMin}
            max={c.scaleMax}
            value={scores[c.id] ?? c.scaleMin}
            onChange={(e) => setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Wert: {scores[c.id] ?? c.scaleMin}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 18 }}>
        <div style={{ marginBottom: 6 }}>
          <strong>Kommentar (optional)</strong>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <button onClick={save} disabled={loading} style={{ marginTop: 16, padding: "10px 14px", width: "100%" }}>
        {loading ? "Speichere..." : "Bewertung speichern"}
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
