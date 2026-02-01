"use client";

import { useEffect, useMemo, useState } from "react";

type PublicData = {
  tasting: { title: string; hostName: string; status: string; wineCount?: number | null };
  criteria: { id: string; label: string; scaleMin: number; scaleMax: number; order: number }[];
  // optional: falls deine API schon Weindetails liefert
  wine?: {
    blindNumber?: number | null;
    winery?: string | null;
    grape?: string | null;
    vintage?: string | null;
    ownerName?: string | null;
    displayName?: string | null;
  };
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

  // load public data (tasting + criteria + optional wine info)
  useEffect(() => {
    (async () => {
      try {
        setMsg(null);
        const res = await fetch(`/api/tasting/public?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Load failed");

        // optional: wenn deine public API nur tasting/criteria liefert ist das ok
        const payload: PublicData = {
          tasting: json.tasting,
          criteria: json.criteria,
          wine: json.wine ?? undefined,
        };

        setData(payload);
      } catch (e: any) {
        setMsg(e?.message ?? "Load failed");
      }
    })();
  }, [slug]);

  const orderedCriteria = useMemo(
    () => (data?.criteria ?? []).slice().sort((a, b) => a.order - b.order),
    [data]
  );

  // defaults: wenn noch nichts gewählt, setze auf scaleMin
  useEffect(() => {
    if (!orderedCriteria.length) return;
    setScores((prev) => {
      const next = { ...prev };
      for (const c of orderedCriteria) {
        if (typeof next[c.id] !== "number") next[c.id] = c.scaleMin;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCriteria.length]);

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

  const wineCount = Number(data?.tasting?.wineCount ?? 0) || undefined;
  const prevHref = blindNumber > 1 ? `/t/${encodeURIComponent(slug)}/wine/${blindNumber - 1}` : null;
  const nextHref = wineCount
    ? blindNumber < wineCount
      ? `/t/${encodeURIComponent(slug)}/wine/${blindNumber + 1}`
      : null
    : `/t/${encodeURIComponent(slug)}/wine/${blindNumber + 1}`; // fallback ohne Limit

  const wineTitleLine = useMemo(() => {
    const w = data?.wine;
    const parts: string[] = [];
    if (w?.winery) parts.push(w.winery);
    if (w?.displayName) parts.push(w.displayName);
    if (w?.grape) parts.push(w.grape);
    if (w?.vintage) parts.push(w.vintage);
    return parts.join(" · ");
  }, [data?.wine]);

  return (
    <div style={pageStyle}>
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/join-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(2px)",
          transform: "scale(1.05)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.78) 60%, rgba(0,0,0,0.9) 100%)",
        }}
      />

      {/* Content */}
      <div style={centerWrapStyle}>
        <div style={cardStyle}>
          {/* Top nav */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
            <a href={`/t/${encodeURIComponent(slug)}`} style={ghostLinkStyle}>
              ← Übersicht
            </a>

            <div style={{ display: "flex", gap: 8 }}>
              {prevHref ? (
                <a href={prevHref} style={ghostLinkStyle}>
                  ← Wein {blindNumber - 1}
                </a>
              ) : (
                <span style={{ ...ghostLinkStyle, opacity: 0.35, cursor: "default" }}>← Zurück</span>
              )}

              {nextHref ? (
                <a href={nextHref} style={ghostLinkStyle}>
                  Wein {blindNumber + 1} →
                </a>
              ) : (
                <span style={{ ...ghostLinkStyle, opacity: 0.35, cursor: "default" }}>Weiter →</span>
              )}
            </div>
          </div>

          <h1 style={h1Style}>🍷 Wein #{blindNumber} bewerten</h1>

          {data && (
            <p style={subStyle}>
              {data.tasting.title} · {data.tasting.hostName}
              {typeof wineCount === "number" && wineCount > 0 ? (
                <span style={{ opacity: 0.7 }}> · {blindNumber}/{wineCount}</span>
              ) : null}
            </p>
          )}

          {/* Optional wine details line (works if API provides it) */}
          {wineTitleLine ? (
            <div style={wineMetaBoxStyle}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Details</div>
              <div style={{ opacity: 0.9, lineHeight: 1.35 }}>{wineTitleLine}</div>
            </div>
          ) : null}

          {!data && <p style={{ opacity: 0.85 }}>Lade…</p>}

          {/* Criteria sliders */}
          <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
            {orderedCriteria.map((c) => {
              const val = typeof scores[c.id] === "number" ? scores[c.id] : c.scaleMin;

              return (
                <div key={c.id} style={critBoxStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div style={{ fontWeight: 800 }}>
                      {c.label}{" "}
                      <span style={{ opacity: 0.7, fontWeight: 600 }}>
                        ({c.scaleMin}–{c.scaleMax})
                      </span>
                    </div>
                    <div style={badgeStyle}>{val}</div>
                  </div>

                  <input
                    type="range"
                    min={c.scaleMin}
                    max={c.scaleMax}
                    value={val}
                    onChange={(e) => setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                    style={{ width: "100%", marginTop: 10 }}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.75 }}>
                    <span>{c.scaleMin}</span>
                    <span>{c.scaleMax}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comment */}
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 800 }}>Kommentar (optional)</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              style={textareaStyle}
              placeholder="z.B. fruchtig, gute Balance, langer Abgang…"
            />
          </div>

          {/* Save */}
          <button
            onClick={save}
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 14,
            }}
          >
            {loading ? "Speichere..." : "Bewertung speichern"}
          </button>

          {msg && (
            <p style={{ marginTop: 12, color: msg.includes("✅") ? "white" : "#ffb4b4" }}>
              {msg}
            </p>
          )}

          <p style={footerStyle}>
            Tipp: Du kannst jederzeit zwischen Weinen springen – gespeicherte Bewertungen bleiben erhalten.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Styles */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
};

const centerWrapStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  background: "rgba(20,20,20,0.75)",
  backdropFilter: "blur(6px)",
  borderRadius: 16,
  padding: 22,
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  color: "white",
};

const h1Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
  fontSize: 24,
  textAlign: "center",
  letterSpacing: 0.2,
};

const subStyle: React.CSSProperties = {
  textAlign: "center",
  opacity: 0.85,
  marginTop: 0,
  marginBottom: 10,
};

const wineMetaBoxStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: 12,
  marginTop: 10,
};

const critBoxStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: 12,
};

const badgeStyle: React.CSSProperties = {
  minWidth: 42,
  textAlign: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 900,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.18)",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  outline: "none",
  fontSize: 15,
  background: "rgba(0,0,0,0.25)",
  color: "white",
  resize: "vertical",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  color: "white",
  fontSize: 16,
  fontWeight: 800,
};

const ghostLinkStyle: React.CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  color: "white",
  fontWeight: 700,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.14)",
  padding: "8px 10px",
  borderRadius: 10,
};

const footerStyle: React.CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  opacity: 0.6,
  textAlign: "center",
};
