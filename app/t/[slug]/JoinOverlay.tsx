"use client";

import { useMemo, useState } from "react";

type Props = {
  slug: string;
  title?: string;
  subtitle?: string;
};

export default function JoinOverlay({
  slug,
  title = "Weiterbewerten",
  subtitle = "Du bist nicht eingeloggt (anderes Gerät / Cookies gelöscht). Bitte gib deinen Namen und die 4-stellige PIN ein.",
}: Props) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return slug.trim().length > 0 && name.trim().length > 0 && pin.trim().length === 4 && !loading;
  }, [slug, name, pin, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: String(slug ?? "").trim(),
          name: String(name ?? "").trim(),
          pin: String(pin ?? "").trim(),
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data?.ok) {
        setError(String(data?.error ?? "Login fehlgeschlagen"));
        setLoading(false);
        return;
      }

      // ✅ WICHTIG: harter Reload => Server liest Cookie garantiert neu
      window.location.href = `/t/${encodeURIComponent(String(slug).trim())}`;
    } catch (err: any) {
      setError(err?.message ?? "Netzwerkfehler");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 16,
          padding: 18,
          background: "rgba(20,20,20,.75)",
          color: "white",
          boxShadow: "0 16px 60px rgba(0,0,0,.45)",
          border: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 20 }}>🍷</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
        </div>

        <div style={{ opacity: 0.9, marginBottom: 12, lineHeight: 1.35 }}>{subtitle}</div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Runde (Slug)</div>
            <input
              value={slug}
              disabled
              style={inputStyle}
              aria-label="slug"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Dein Vorname</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Jochen"
              style={inputStyle}
              aria-label="name"
              autoComplete="given-name"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>PIN (4-stellig)</div>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              style={inputStyle}
              aria-label="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              height: 44,
              borderRadius: 12,
              border: "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontWeight: 700,
              background: canSubmit ? "#b21c17" : "rgba(178,28,23,.45)",
              color: "white",
              marginTop: 4,
            }}
          >
            {loading ? "Bitte warten..." : "Beitreten"}
          </button>

          {error ? (
            <div style={{ color: "#ffb4b4", fontSize: 13, marginTop: 4 }}>{error}</div>
          ) : null}

          <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2 }}>
            Tipp: Wenn du über den QR-Code kommst, bist du direkt in der richtigen Runde.
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
  color: "white",
  padding: "0 12px",
  outline: "none",
};
