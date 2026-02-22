"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage({
  searchParams,
}: {
  searchParams?: { slug?: string };
}) {
  const router = useRouter();

  const initialSlug = String(searchParams?.slug ?? "").trim();

  const [slug, setSlug] = useState(initialSlug);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitJoin() {
    setSubmitting(true);
    setError(null);

    try {
      const s = slug.trim().toLowerCase();
      const n = name.trim();
      const p = pin.trim();

      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug: s, name: n, pin: p }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(String(data?.error ?? "Login failed"));
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
    slug.trim().length > 0 &&
    name.trim().length > 0 &&
    pin.trim().length === 4;

  return (
    <div style={pageStyle}>
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
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Dein Vorname</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>PIN (4-stellig)</label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
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
  fontFamily: "system-ui",
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
