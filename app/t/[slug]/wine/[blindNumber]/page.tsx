"use client";

import { useEffect, useMemo, useState } from "react";

type PublicData = {
  tasting: {
    title: string;
    hostName: string;
    status: string;
    wineCount: number;
  };
  criteria: { id: string; label: string; scaleMin: number; scaleMax: number; order: number }[];
  wine?: {
    id: string;
    blindNumber: number | null;
    isActive?: boolean;
    displayName?: string | null;
    winery?: string | null;
    grape?: string | null;
    vintage?: string | null;
  } | null;
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
      setMsg(null);
      try {
        const res = await fetch(
          `/api/tasting/public?slug=${encodeURIComponent(slug)}&blindNumber=${encodeURIComponent(
            String(blindNumber)
          )}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Load failed");

        setData({
          tasting: {
            title: String(json?.tasting?.title ?? ""),
            hostName: String(json?.tasting?.hostName ?? ""),
            status: String(json?.tasting?.status ?? ""),
            wineCount: Number(json?.tasting?.wineCount ?? 10),
          },
          criteria: Array.isArray(json?.criteria) ? json.criteria : [],
          wine: json?.wine ?? null,
        });

        // Optional: Scores initialisieren (damit Slider nicht "springen")
        const initial: Record<string, number> = {};
        for (const c of (Array.isArray(json?.criteria) ? json.criteria : []) as any[]) {
          const id = String(c.id ?? "");
          const min = typeof c.scaleMin === "number" ? c.scaleMin : 1;
          if (id) initial[id] = min;
        }
        setScores((prev) => (Object.keys(prev).length ? prev : initial));
      } catch (e: any) {
        setMsg(e?.message ?? "Load failed");
      }
    })();
  }, [slug, blindNumber]);

  const orderedCriteria = useMemo(
    () => (data?.criteria ?? []).slice().sort((a, b) => a.order - b.order),
    [data]
  );

  const wineCount = data?.tasting?.wineCount ?? 10;
  const prevBn = blindNumber - 1;
  const nextBn = blindNumber + 1;

  const canGoPrev = prevBn >= 1;
  const canGoNext = nextBn <= wineCount;

  const wineTitleLine = useMemo(() => {
    const w = data?.wine ?? null;
    if (!w) return null;

    const parts: string[] = [];
    const winery = typeof w.winery === "string" && w.winery.trim() ? w.winery.trim() : "";
    const name = typeof w.displayName === "string" && w.displayName.trim() ? w.displayName.trim() : "";
    const grape = typeof w.grape === "string" && w.grape.trim() ? w.grape.trim() : "";
    const vintage = typeof w.vintage === "string" && w.vintage.trim() ? w.vintage.trim() : "";

    if (winery) parts.push(winery);
    if (name) parts.push(name);
    if (grape) parts.push(grape);
    if (vintage) parts.push(vintage);

    return parts.length ? parts.join(" · ") : null;
  }, [data]);

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
    <div style={pageStyle}>
      {/* Background wie Join */}
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

      <div style={centerWrapStyle}>
        <div style={cardStyle}>
          {/* Top Nav */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <a href={`/t/${encodeURIComponent(slug)}`} style={ghostLinkStyle}>
              ← Übersicht
            </a>

            <div style={{ flex: 1 }} />

            <a
              href={canGoPrev ? `/t/${encodeURIComponent(slug)}/wine/${prevBn}` : "#"}
              onClick={(e) => {
                if (!canGoPrev) e.preventDefault();
              }}
              style={{
                ...navBtnStyle,
                opacity: canGoPrev ? 1 : 0.45,
                pointerEvents: canGoPrev ? "auto" : "none",
              }}
            >
              ← Zurück
            </a>
            <a
              href={canGoNext ? `/t/${encodeURIComponent(slug)}/wine/${nextBn}` : "#"}
              onClick={(e) => {
                if (!canGoNext) e.preventDefault();
              }}
              style={{
                ...navBtnStyle,
                opacity: canGoNext ? 1 : 0.45,
                pointerEvents: canGoNext ? "auto" : "none",
              }}
            >
              Weiter →
            </a>
          </div>

          <h1 style={h1Style}>Wein #{blindNumber} bewerten</h1>

          {data && (
            <p style={subStyle}>
              {data.tasting.title} · {data.tasting.hostName}
            </p>
          )}

          {/* Wein-Details */}
          {wineTitleLine && (
            <div style={wineInfoStyle}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Wein-Details</div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{wineTitleLine}</div>
            </div>
          )}

          {!data && <p style={{ opacity: 0.85 }}>Lade...</p>}

          {orderedCriteria.map((c) => {
            const current = scores[c.id] ?? c.scaleMin;
            return (
              <div key={c.id} style={critWrapStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>
                    {c.label}{" "}
                    <span style={{ fontWeight: 500, opacity: 0.7 }}>
                      ({c.scaleMin}–{c.scaleMax})
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, opacity: 0.95 }}>{current}</div>
                </div>

                <input
                  type="range"
                  min={c.scaleMin}
                  max={c.scaleMax}
                  value={current}
                  onChange={(e) =>
                    setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))
                  }
                  style={{ width: "100%", marginTop: 10 }}
                />
              </div>
            );
          })}

          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 6, fontWeight: 800 }}>Kommentar (optional)</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              style={textareaStyle}
              placeholder="Kurznotiz (z.B. Kräuter, Säure, Tannin …)"
            />
          </div>

          <button
            onClick={save}
            disabled={loading}
            style={{
              ...primaryBtnStyle,
              opacity: loading ? 0.75 : 1,
              cursor: loading ? "not-allowed" : "pointer",
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
            Tipp: Du kannst direkt mit „Weiter“ zum nächsten Wein springen.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Styles (wie Join: Card + Background) */
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
  maxWidth: 520,
  background: "rgba(20,20,20,0.78)",
  backdropFilter: "blur(6px)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  color: "white",
};

const h1Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
  fontSize: 24,
  textAlign: "left",
  letterSpacing: 0.2,
};

const subStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
  opacity: 0.85,
};

const wineInfoStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.14)",
  marginBottom: 14,
};

const critWrapStyle: React.CSSProperties = {
  marginTop: 12,
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  marginTop: 16,
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  color: "white",
  fontSize: 16,
  fontWeight: 800,
};

const navBtnStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "white",
  fontWeight: 800,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.16)",
};

const ghostLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "white",
  opacity: 0.9,
  fontWeight: 700,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
};

const footerStyle: React.CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  opacity: 0.6,
  textAlign: "center",
};
