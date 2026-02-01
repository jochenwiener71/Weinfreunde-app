"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function JoinPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const [slug, setSlug] = useState(sp.get("slug") ?? "");
  const [pin, setPin] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!slug.trim()) return false;
    if (!/^\d{4}$/.test(pin.trim())) return false;
    if (!alias.trim()) return false;
    return true;
  }, [slug, pin, alias]);

  async function submit() {
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          pin: pin.trim(),
          alias: alias.trim(),
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setMsg("Registriert ✅");

      // Danach z.B. zur Tasting-Seite (falls vorhanden)
      // Wenn du noch keine Seite hast, kannst du hier erstmal nur Erfolg anzeigen.
      router.push(`/t/${encodeURIComponent(slug.trim())}`);
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}>
      <h1 style={{ marginBottom: 6 }}>Weinfreunde · Join</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        QR gescannt? Dann ist der Slug schon drin. Jetzt Name + PIN eingeben.
      </p>

      <label style={{ display: "block", marginTop: 14 }}>
        Tasting-Slug
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="weinrunde-2026-01-30"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        PIN (4-stellig)
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="1234"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        Vorname
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Max"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </label>

      <button
        onClick={submit}
        disabled={!canSubmit || loading}
        style={{ padding: "12px 14px", width: "100%", fontSize: 16, marginTop: 16 }}
      >
        {loading ? "Sende..." : "Registrieren"}
      </button>

      {msg && (
        <p style={{ marginTop: 12, color: msg.includes("✅") ? "inherit" : "crimson" }}>
          {msg}
        </p>
      )}

      <p style={{ marginTop: 18, fontSize: 12, opacity: 0.7 }}>
        Link-Format für QR: <code>/join?slug=DEIN_PUBLIC_SLUG</code>
      </p>
    </main>
  );
}
