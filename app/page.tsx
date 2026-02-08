"use client";

import { useState } from "react";

export default function Home() {
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  const [alias, setAlias] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        // 🔧 FIX: alias → name
        body: JSON.stringify({
          slug: slug.trim(),
          pin: pin.trim(),
          name: alias.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Join failed");

      // Session cookie wird serverseitig gesetzt
      window.location.href = `/t/${encodeURIComponent(slug.trim())}`;
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Weinfreunde Tasting App</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        QR/Link öffnen → PIN eingeben → Weine bewerten.
      </p>

      <div style={{ marginTop: 24, maxWidth: 420 }}>
        <label>
          Tasting-Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="z. B. weinrunde-2026-01-30"
            style={{ width: "100%", padding: 10, marginTop: 6, marginBottom: 12 }}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        <label>
          4-stelliger PIN
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="1234"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            style={{ width: "100%", padding: 10, marginTop: 6, marginBottom: 12 }}
          />
        </label>

        <label>
          Alias (optional)
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="z. B. Max"
            style={{ width: "100%", padding: 10, marginTop: 6, marginBottom: 12 }}
          />
        </label>

        <button
          onClick={join}
          disabled={loading || !slug.trim() || pin.trim().length !== 4}
          style={{ padding: "10px 14px", width: "100%" }}
        >
          {loading ? "Beitreten..." : "Tasting beitreten"}
        </button>

        {msg && (
          <p style={{ marginTop: 12, color: "crimson" }}>
            {msg}
          </p>
        )}
      </div>

      <hr style={{ marginTop: 28, opacity: 0.2 }} />

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Hinweis: Wenn du noch kein Tasting angelegt hast, wird Join mit „Tasting not found“ oder „Tasting not open“ antworten.
      </p>
    </main>
  );
}
