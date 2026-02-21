"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type CheckResp =
  | { ok: true; session: any }
  | { ok: false; error?: string };

export default function TastingSlugLandingPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  const slug = useMemo(() => String(params?.slug ?? "").trim(), [params]);

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  // Overlay state
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkSession() {
    setChecking(true);
    setError(null);

    try {
      const res = await fetch("/api/session/check", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as CheckResp;

      if (res.ok && data && (data as any).ok === true) {
        setLoggedIn(true);
        setOverlayOpen(false);
      } else {
        setLoggedIn(false);
        setOverlayOpen(true);
      }
    } catch (e: any) {
      setLoggedIn(false);
      setOverlayOpen(true);
      setError(e?.message ?? "Session check failed");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function submitJoin() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug,
          name: name.trim(),
          pin: pin.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(String(data?.error ?? "Login failed"));
        return;
      }

      // Cookie gesetzt -> Session neu prüfen und dann weiter
      await checkSession();

      // Direkt zur Bewertung (Wein #1)
      window.location.href = `/t/${encodeURIComponent(slug)}/wine/1`;
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Wenn eingeloggt: direkt zu Wein #1
  useEffect(() => {
    if (checking) return;
    if (!loggedIn) return;

    router.replace(`/t/${encodeURIComponent(slug)}/wine/1`);
  }, [checking, loggedIn, router, slug]);

  return (
    <div style={pageStyle}>
      {/* Background wie Bewertung */}
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
          <h1 style={h1Style}>Weinprobe</h1>
          <p style={subStyle}>
            {slug ? (
              <>
                Runde: <b>{slug}</b>
              </>
            ) : (
              "Runde wird geladen …"
            )}
          </p>

          <div style={infoBoxStyle}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
              Status
            </div>
            <div style={{ fontSize: 14, fontWeight: 750, lineHeight: 1.35 }}>
              {checking
                ? "Session wird geprüft …"
                : loggedIn
                ? "Eingeloggt – leite zur Bewertung weiter …"
                : "Nicht eingeloggt – bitte Name + PIN eingeben."}
            </div>
          </div>

          {!loggedIn && (
            <button
              onClick={() => setOverlayOpen(true)}
              style={{
                ...primaryBtnStyle,
                opacity: !slug ? 0.6 : 1,
                cursor: !slug ? "not-allowed" : "pointer",
              }}
              disabled={!slug}
            >
              Einloggen
            </button>
          )}

          <p style={footerStyle}>
            Tipp: Wenn du über den QR-Code kommst, bist du direkt in der richtigen Runde.
          </p>
        </div>
      </div>

      {/* Login Overlay (optisch wie Bewertungs-Overlay) */}
      {overlayOpen && (
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
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: "0 0 6px 0" }}>Einloggen</h2>
                <p style={{ margin: "0 0 14px 0", opacity: 0.85, fontSize: 13 }}>
                  Bitte gib deinen Namen und die 4-stellige PIN ein.
                </p>
              </div>

              <button
                onClick={() => setOverlayOpen(false)}
                style={{
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.10)",
                  color: "white",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                  Runde (Slug)
                </div>
                <input
                  value={slug}
                  readOnly
                  style={inputStyleReadOnly}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                  Dein Vorname
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Jochen"
                  autoFocus
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                  PIN (4-stellig)
                </div>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  style={inputStyle}
                />
              </div>

              {error && (
                <div
                  style={{
                    borderRadius: 12,
                    padding: 10,
                    border: "1px solid rgba(255,120,120,0.35)",
                    background: "rgba(255,0,0,0.10)",
                    color: "#ffd1d1",
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                onClick={submitJoin}
                disabled={
                  submitting || !slug || name.trim().length < 1 || pin.trim().length < 4
                }
                style={{
                  ...primaryBtnStyle,
                  opacity:
                    submitting || !slug || name.trim().length < 1 || pin.trim().length < 4
                      ? 0.65
                      : 1,
                  cursor:
                    submitting || !slug || name.trim().length < 1 || pin.trim().length < 4
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submitting ? "Bitte warten …" : "Beitreten"}
              </button>

              <div style={{ fontSize: 12, opacity: 0.65, textAlign: "center" }}>
                Nach dem Login wirst du direkt zu <b>Wein #1</b> weitergeleitet.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Styles (wie Bewertung: Card + Background) */
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
  fontSize: 26,
  textAlign: "left",
  letterSpacing: 0.2,
};

const subStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
  opacity: 0.85,
};

const infoBoxStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.14)",
  marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
};

const inputStyleReadOnly: React.CSSProperties = {
  ...inputStyle,
  opacity: 0.85,
};

const primaryBtnStyle: React.CSSProperties = {
  marginTop: 6,
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  color: "white",
  fontSize: 16,
  fontWeight: 900,
};

const footerStyle: React.CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  opacity: 0.6,
  textAlign: "center",
};
