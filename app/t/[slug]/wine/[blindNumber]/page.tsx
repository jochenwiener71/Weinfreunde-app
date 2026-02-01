"use client";

import { useEffect, useMemo, useState } from "react";

type PublicData = {
  tasting: { title: string; hostName: string; status: string };
  criteria: { id: string; label: string; scaleMin: number; scaleMax: number; order: number }[];
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

export default function WineRatePage({
  params,
}: {
  params: { slug: string; blindNumber: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const blindNumber = Number(params.blindNumber);

  const [data, setData] = useState<PublicData | null>(null);

  // wines meta (für max / Details)
  const [wineCount, setWineCount] = useState<number | null>(null);
  const [wines, setWines] = useState<WineSlotPublic[]>([]);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load public tasting + criteria
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tasting/public?slug=${encodeURIComponent(slug)}`);
        const json = await res.json().catch(() => ({}));
        if (res.ok) setData({ tasting: json.tasting, criteria: json.criteria });
        else setMsg(json?.error ?? "Load failed");
      } catch (e: any) {
        setMsg(e?.message ?? "Load failed");
      }
    })();
  }, [slug]);

  // Load wines (für wineCount + Wein-Details, sobald Admin sie eingetragen hat)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tasting/wines?publicSlug=${encodeURIComponent(slug)}`);
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setWineCount(typeof json.wineCount === "number" ? json.wineCount : null);
          setWines(Array.isArray(json.wines) ? json.wines : []);
        }
      } catch {
        // wines sind optional – keine harte Fehlermeldung
      }
    })();
  }, [slug]);

  const orderedCriteria = useMemo(
    () => (data?.criteria ?? []).slice().sort((a, b) => a.order - b.order),
    [data]
  );

  // aktueller Wein-Slot (für Details)
  const currentWine = useMemo(() => {
    return wines.find((w) => w.blindNumber === blindNumber) ?? null;
  }, [wines, blindNumber]);

  const canPrev = blindNumber > 1;
  const canNext = wineCount ? blindNumber < wineCount : true; // falls wineCount noch nicht geladen, allow
  const prevHref = `/t/${encodeURIComponent(slug)}/wine/${Math.max(1, blindNumber - 1)}`;
  const nextHref = `/t/${encodeURIComponent(slug)}/wine/${blindNumber + 1}`;

  async function save() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rating/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, blindNumber, scores, comment }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      setMsg("Gespeichert ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720, margin: "0 auto" }}>
      {/* Top Nav */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <a
          href={prevHref}
          aria-disabled={!canPrev}
          style={{
            display: "inline-block",
            padding: "10px 12px",
            borderRadius: 10,
            textDecoration: "none",
            border: "1px solid rgba(0,0,0,0.15)",
            opacity: canPrev ? 1 : 0.4,
            pointerEvents: canPrev ? "auto" : "none",
          }}
        >
          ← Zurück
        </a>

        <div style={{ flex: 1 }} />

        <a
          href={nextHref}
          aria-disabled={!canNext}
          style={{
            display: "inline-block",
            padding: "10px 12px",
            borderRadius: 10,
            textDecoration: "none",
            border: "1px solid rgba(0,0,0,0.15)",
            opacity: canNext ? 1 : 0.4,
            pointerEvents: canNext ? "auto" : "none",
          }}
        >
          Weiter →
        </a>
      </div>

      <h1 style={{ marginBottom: 6 }}>
        Wein #{blindNumber} bewerten
        {wineCount ? (
          <span style={{ fontSize: 14, opacity: 0.7 }}> · {blindNumber}/{wineCount}</span>
        ) : null}
      </h1>

      {data && (
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          {data.tasting.title} · {data.tasting.hostName}
        </p>
      )}

      {/* Wein-Details (sichtbar sobald Admin gepflegt hat UND API sie liefert) */}
      {currentWine && (currentWine.winery || currentWine.grape || currentWine.vintage || currentWine.ownerName) && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Weindetails</div>
          <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
            {currentWine.ownerName ? <div>Gast: {currentWine.ownerName}</div> : null}
            {currentWine.winery ? <div>Weingut: {currentWine.winery}</div> : null}
            {currentWine.grape ? <div>Rebsorte: {currentWine.grape}</div> : null}
            {currentWine.vintage ? <div>Jahrgang: {currentWine.vintage}</div> : null}
          </div>
        </div>
      )}

      {!data && <p style={{ marginTop: 18 }}>Lade...</p>}

      {/* Criteria sliders */}
      {orderedCriteria.map((c) => (
        <div key={c.id} style={{ marginTop: 16 }}>
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

      {/* Comment */}
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

      {/* Save */}
      <button
        onClick={save}
        disabled={loading}
        style={{ marginTop: 16, padding: "12px 14px", width: "100%", borderRadius: 10 }}
      >
        {loading ? "Speichere..." : "Bewertung speichern"}
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      {/* Bottom Nav (praktisch auf Mobile) */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <a
          href={prevHref}
          aria-disabled={!canPrev}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "12px 12px",
            borderRadius: 10,
            textDecoration: "none",
            border: "1px solid rgba(0,0,0,0.15)",
            opacity: canPrev ? 1 : 0.4,
            pointerEvents: canPrev ? "auto" : "none",
          }}
        >
          ← Zurück
        </a>

        <a
          href={nextHref}
          aria-disabled={!canNext}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "12px 12px",
            borderRadius: 10,
            textDecoration: "none",
            border: "1px solid rgba(0,0,0,0.15)",
            opacity: canNext ? 1 : 0.4,
            pointerEvents: canNext ? "auto" : "none",
          }}
        >
          Weiter →
        </a>
      </div>
    </main>
  );
}
