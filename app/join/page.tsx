"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CheckResp =
  | { ok: true; session: any }
  | { ok: false; error?: string };

type JoinResp =
  | { ok: true }
  | { ok: false; error?: string };

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const slugFromUrl = useMemo(() => {
    return String(searchParams.get("slug") ?? "").trim();
  }, [searchParams]);

  const [slug, setSlug] = useState(slugFromUrl);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync slug when coming from QR
  useEffect(() => {
    if (slugFromUrl && slugFromUrl !== slug) {
      setSlug(slugFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugFromUrl]);

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

      if (res.ok && (data as any)?.ok === true) {
        const s = String(slug ?? "").trim();
        if (s) {
          router.replace(`/t/${encodeURIComponent(s)}/wine/1`);
          return;
        }
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!String(slug ?? "").trim()) {
      setChecking(false);
      return;
    }
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function submitJoin() {
    setSubmitting(true);
    setError(null);

    try {
      const s = String(slug ?? "").trim().toLowerCase();
      const n = String(name ?? "").trim();
      const p = String(pin ?? "").trim();

      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug: s, name: n, pin: p }),
      });

      const data = (await res.json().catch(() => ({}))) as JoinResp;

      if (!res.ok || !(data as any)?.ok) {
        setError(String((data as any)?.error ?? "Login failed"));
        return;
      }

      router.replace(`/t/${encodeURIComponent(s)}/wine/1`);
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !checking &&
    String(slug ?? "").trim().length > 0 &&
    String(name ?? "").trim().length > 0 &&
    String(pin ?? "").trim().length === 4;

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

      <div style={centerWrapStyle}>
        <div style={cardStyle}>
          <h1 style={h1Style}>Einloggen</h1>
          <p style={subStyle}>
            Bitte gib deinen Namen und die 4-stellige PIN ein.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={labelStyle}>Runde (Slug)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="z.B. weinfreunde-feb26"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Dein Vorname</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="z.B. Jochen"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>PIN (4-stellig)</label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="1234"
                style={inputStyle}
              />
            </div>

            {error && <div style={errorBoxStyle}>{error}</div>}

            <button
              onClick={submitJoin}
              disabled={!canSubmit || submitting}
              style={{
                ...primaryBtnStyle,
                opacity: !canSubmit || submitting ? 0.6 : 1,
                cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Bitte warten …" : "Beitreten"}
            </button>

            <div style={footerStyle}>
              Nach dem Login wirst du direkt zu <b>Wein #1</b> weitergeleitet.
            </div>
          </div>
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
  maxWidth: 520,
  background: "rgba(20,20,20,0.78)",
  backdropFilter: "blur(6px)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
};

const h1Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 6,
  fontSize: 28,
};

const subStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  opacity: 0.85,
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 800,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  color: "white",
  fontSize: 16,
  fontWeight: 900,
};

const errorBoxStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: 12,
  background: "rgba(255, 80, 80, 0.12)",
  border: "1px solid rgba(255, 80, 80, 0.30)",
  color: "#ffd1d1",
  fontSize: 13,
};

const footerStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  opacity: 0.65,
  textAlign: "center",
};

      const data = (await res.json().catch(() => ({}))) as CheckResp;

      // Wenn Session vorhanden -> direkt zur Bewertung (Wein #1)
      if (res.ok && (data as any)?.ok === true) {
        const s = String(slug ?? "").trim();
        if (s) {
          router.replace(`/t/${encodeURIComponent(s)}/wine/1`);
          return;
        }
      }
    } catch {
      // ignore (User sieht dann einfach Login)
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    // Session nur prüfen, wenn wir einen slug haben (QR oder manuell)
    if (!String(slug ?? "").trim()) {
      setChecking(false);
      return;
    }
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function submitJoin() {
    setSubmitting(true);
    setError(null);

    try {
      const s = String(slug ?? "").trim().toLowerCase();
      const n = String(name ?? "").trim();
      const p = String(pin ?? "").trim();

      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug: s, name: n, pin: p }),
      });

      const data = (await res.json().catch(() => ({}))) as JoinResp;

      if (!res.ok || !(data as any)?.ok) {
        setError(String((data as any)?.error ?? "Login failed"));
        return;
      }

      // ✅ Cookie ist gesetzt -> direkt in Bewertung (Wein #1)
      router.replace(`/t/${encodeURIComponent(s)}/wine/1`);
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !checking &&
    String(slug ?? "").trim().length > 0 &&
    String(name ?? "").trim().length > 0 &&
    String(pin ?? "").trim().length === 4;

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
          <h1 style={h1Style}>Einloggen</h1>
          <p style={subStyle}>
            Bitte gib deinen Namen und die 4-stellige PIN ein.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={labelStyle}>Runde (Slug)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="z.B. weinfreunde-feb26"
                style={inputStyle}
              />
              <div style={hintStyle}>
                Tipp: Wenn du über den QR-Code kommst, ist das Feld automatisch befüllt.
              </div>
            </div>

            <div>
              <label style={labelStyle}>Dein Vorname</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="z.B. Jochen"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>PIN (4-stellig)</label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="1234"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={errorBoxStyle}>
                {error}
              </div>
            )}

            <button
              onClick={submitJoin}
              disabled={!canSubmit || submitting}
              style={{
                ...primaryBtnStyle,
                opacity: !canSubmit || submitting ? 0.6 : 1,
                cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Bitte warten …" : "Beitreten"}
            </button>

            <div style={footerStyle}>
              Nach dem Login wirst du direkt zu <b>Wein #1</b> weitergeleitet.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Styles (identisch zum Bewertungs-Look) */
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
  border: "1px solid rgba(255,255,255,0.12)",
};

const h1Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 6,
  fontSize: 28,
  textAlign: "left",
  letterSpacing: 0.2,
};

const subStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  opacity: 0.85,
  fontSize: 13,
  lineHeight: 1.4,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 800,
  fontSize: 13,
  opacity: 0.9,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
};

const hintStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  opacity: 0.6,
};

const primaryBtnStyle: React.CSSProperties = {
  marginTop: 4,
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  color: "white",
  fontSize: 16,
  fontWeight: 900,
};

const errorBoxStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: 12,
  background: "rgba(255, 80, 80, 0.12)",
  border: "1px solid rgba(255, 80, 80, 0.30)",
  color: "#ffd1d1",
  fontSize: 13,
};

const footerStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  opacity: 0.65,
  textAlign: "center",
};
