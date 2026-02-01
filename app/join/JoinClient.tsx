"use client";

import { useMemo, useState } from "react";

type Props = {
  initialSlug: string;
};

export default function JoinClient({ initialSlug }: Props) {
  const [slug, setSlug] = useState(initialSlug);
  const [pin, setPin] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const canSubmit = useMemo(() => {
    if (!slug.trim()) return false;
    if (!/^\d{4}$/.test(pin.trim())) return false;
    return true;
  }, [slug, pin]);

  async function submit() {
    setMsg(null);
    setLoading(true);

    try {
      const body = {
        slug: slug.trim(),
        pin: pin.trim(),
        alias: alias.trim(),
      };

      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) {
        throw new Error(data?.error ? String(data.error) : `HTTP ${res.status}`);
      }

      setJoined(true);
      setMsg("Registrierung erfolgreich ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Join fehlgeschlagen");
      setJoined(false);
    } finally {
      setLoading(false);
    }
  }

  const cleanedSlug = slug.trim();

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

      {/* Card */}
      <div style={centerWrapStyle}>
        <div style={cardStyle}>
          <h1 style={h1Style}>🍷 Weinprobe</h1>
          <p style={subStyle}>Bitte registriere dich zur Teilnahme</p>

          {/* ✅ Nach erfolgreichem Join: Formular + Beitreten-Button ausblenden */}
          {!joined ? (
            <div style={{ display: "grid", gap: 12 }}>
              <label style={labelStyle}>
                Runde (Slug)
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="weinfreunde"
                  style={inputStyle}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <div style={hintStyle}>
                  Tipp: Wenn du über QR-Code kommst, ist das Feld automatisch befüllt.
                </div>
              </label>

              <label style={labelStyle}>
                Dein Vorname
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Max"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                PIN (4-stellig)
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                  placeholder="1234"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  style={inputStyle}
                />
              </label>

              <button
                onClick={submit}
                disabled={!canSubmit || loading}
                style={{
                  ...buttonStyle,
                  opacity: !canSubmit || loading ? 0.7 : 1,
                  cursor: !canSubmit || loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Beitreten..." : "Beitreten"}
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
              {/* ✅ KORREKTER PFAD ZUR BEWERTUNG: /t/[slug]/wine/[blindNumber] */}
              <a
                href={`/t/${encodeURIComponent(cleanedSlug)}/wine/1`}
                style={linkButtonStyle}
              >
                Zur Bewertung von Wein #1 →
              </a>
            </div>
          )}

          {msg && (
            <p style={{ marginTop: 14, color: msg.includes("✅") ? "white" : "#ffb4b4" }}>
              {msg}
            </p>
          )}

          <p style={footerStyle}>
            Nach der Registrierung kannst du bewerten, sobald die Verkostung startet.
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
  maxWidth: 440,
  background: "rgba(20,20,20,0.75)",
  backdropFilter: "blur(6px)",
  borderRadius: 16,
  padding: 28,
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  color: "white",
};

const h1Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
  fontSize: 26,
  textAlign: "center",
  letterSpacing: 0.3,
};

const subStyle: React.CSSProperties = {
  textAlign: "center",
  opacity: 0.85,
  marginTop: 0,
  marginBottom: 20,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  opacity: 0.95,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  lineHeight: 1.35,
};

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  outline: "none",
  fontSize: 16,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  color: "white",
  fontSize: 16,
  fontWeight: 700,
};

const linkButtonStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "12px 14px",
  borderRadius: 10,
  textDecoration: "none",
  color: "white",
  fontWeight: 700,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.18)",
};

const footerStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 12,
  opacity: 0.6,
  textAlign: "center",
};
