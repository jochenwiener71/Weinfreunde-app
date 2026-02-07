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

type ScoresMap = Record<string, number>;

function draftKey(slug: string, blindNumber: number) {
  return `wf_draft_${slug}_wine_${blindNumber}`;
}

function encode(s: string) {
  return encodeURIComponent(s);
}

export default function WineRatePage({
  params,
}: {
  params: { slug: string; blindNumber: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const blindNumber = Number(params.blindNumber);

  const [data, setData] = useState<PublicData | null>(null);
  const [scores, setScores] = useState<ScoresMap>({});
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Weiterbewerten-Overlay (Name + PIN)
  const [showResume, setShowResume] = useState(false);
  const [resumeName, setResumeName] = useState("");
  const [resumePin, setResumePin] = useState("");
  const [resumeLoading, setResumeLoading] = useState(false);

  // 1) Public Daten laden (Tasting + Criteria + Wine)
  useEffect(() => {
    (async () => {
      setMsg(null);
      try {
        const res = await fetch(
          `/api/tasting/public?slug=${encode(slug)}&blindNumber=${encode(String(blindNumber))}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Load failed");

        const criteria = Array.isArray(json?.criteria) ? json.criteria : [];

        setData({
          tasting: {
            title: String(json?.tasting?.title ?? ""),
            hostName: String(json?.tasting?.hostName ?? ""),
            status: String(json?.tasting?.status ?? ""),
            wineCount: Number(json?.tasting?.wineCount ?? 10),
          },
          criteria,
          wine: json?.wine ?? null,
        });

        // Default initial scores (min) – wird später ggf. durch Draft oder Server überschrieben
        const initial: ScoresMap = {};
        for (const c of criteria as any[]) {
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

  // 2) Draft aus sessionStorage wiederherstellen (damit Zurück/Weiter nichts “verliert”)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey(slug, blindNumber));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.scores && typeof parsed.scores === "object") setScores(parsed.scores);
      if (typeof parsed?.comment === "string") setComment(parsed.comment);
    } catch {
      // ignore
    }
  }, [slug, blindNumber]);

  // 3) Gespeichertes Rating vom Server laden (falls vorhanden) – überschreibt Draft NICHT, wenn Draft existiert
  useEffect(() => {
    (async () => {
      try {
        const rawDraft = sessionStorage.getItem(draftKey(slug, blindNumber));
        const hasDraft = !!rawDraft;

        const res = await fetch(
          `/api/rating/get?slug=${encode(slug)}&blindNumber=${encode(String(blindNumber))}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) return;

        if (!hasDraft && json?.ok && json?.exists && json?.rating) {
          const r = json.rating;
          if (r?.scores && typeof r.scores === "object") setScores(r.scores);
          if (typeof r?.comment === "string") setComment(r.comment);
        }
      } catch {
        // ignore
      }
    })();
  }, [slug, blindNumber]);

  // 4) Draft automatisch speichern, sobald der User etwas ändert
  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftKey(slug, blindNumber),
        JSON.stringify({ scores, comment, ts: Date.now() })
      );
    } catch {
      // ignore
    }
  }, [slug, blindNumber, scores, comment]);

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

  // ✅ Session wiederherstellen ohne Join (Name + PIN)
  async function resumeSession() {
    setMsg(null);
    setResumeLoading(true);
    try {
      const res = await fetch("/api/session/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name: resumeName, pin: resumePin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Resume failed");

      setShowResume(false);
      setMsg("Weiterbewerten aktiviert ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Resume failed");
    } finally {
      setResumeLoading(false);
    }
  }

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

      if (!res.ok) {
        const errMsg = String(json?.error ?? "Save failed");
        if (errMsg.toLowerCase().includes("not logged in")) {
          setShowResume(true);
          throw new Error("Sitzung abgelaufen – bitte Name + PIN bestätigen.");
        }
        throw new Error(errMsg);
      }

      // ✅ Draft löschen, weil jetzt server-seitig gespeichert
      try {
        sessionStorage.removeItem(draftKey(slug, blindNumber));
      } catch {
        // ignore
      }

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
            <a href={`/t/${encode(slug)}`} style={ghostLinkStyle}>
              ← Übersicht
            </a>

            <div style={{ flex: 1 }} />

            <a
              href={canGoPrev ? `/t/${encode(slug)}/wine/${prevBn}` : "#"}
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
              href={canGoNext ? `/t/${encode(slug)}/wine/${nextBn}` : "#"}
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

      {/* ✅ Weiterbewerten Overlay (wenn Not logged in) */}
      {showResume && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "rgba(20,20,20,0.92)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 14,
              padding: 18,
              color: "white",
            }}
          >
            <h2 style={{ margin: "0 0 8px 0" }}>Weiterbewerten</h2>
            <p style={{ margin: "0 0 14px 0", opacity: 0.85, fontSize: 13 }}>
              Deine Sitzung ist abgelaufen. Bitte bestätige kurz Name + PIN.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={resumeName}
                onChange={(e) => setResumeName(e.target.value)}
                placeholder="Name"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              />
              <input
                value={resumePin}
                onChange={(e) => setResumePin(e.target.value)}
                placeholder="PIN (4-stellig)"
                inputMode="numeric"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              />

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowResume(false)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.10)",
                    color: "white",
                    fontWeight: 800,
                  }}
                >
                  Abbrechen
                </button>

                <button
                  onClick={resumeSession}
                  disabled={resumeLoading}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #8e0e00, #c0392b)",
                    color: "white",
                    fontWeight: 900,
                    opacity: resumeLoading ? 0.75 : 1,
                    cursor: resumeLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {resumeLoading ? "…" : "Weiter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
