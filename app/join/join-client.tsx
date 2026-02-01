"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function JoinClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const prefilledSlug = String(sp.get("slug") ?? "").trim();

  const [slug, setSlug] = useState(prefilledSlug);
  const [pin, setPin] = useState("");
  const [alias, setAlias] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!slug.trim()) return false;
    if (!/^\d{4}$/.test(pin.trim())) return false;
    return true;
  }, [slug, pin]);

  async function submit() {
    setMsg(null);
    setLoading(true);

    try {
      const cleanSlug = slug.trim();

      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: cleanSlug,
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

      if (!res.ok) throw new Error(data?.error ? String(data.error) : `HTTP ${res.status}`);

      setMsg("Registriert ✅ — weiterleiten…");

      // ✅ Redirect auf deine Tasting-Seite (app/t/[slug])
      router.push(`/t/${encodeURIComponent(cleanSlug)}`);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}>
      <h1 style={{ marginBottom: 6 }}>Beitreten</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        QR scannen oder Slug eingeben, dann mit PIN registrieren.
      </p>

      <section style={{ marginTop: 16 }}>
        <label style={{ display: "block" }}>
          publicSlug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="weinfreunde"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
      </section>

      <section style={{ marginTop: 12 }}>
        <label style={{ display: "block" }}>
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
      </section>

      <section style={{ marginTop: 12 }}>
        <label style={{ display: "block" }}>
          Vorname (optional)
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Max"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>
      </section>

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

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
        QR-Link: <code>/join?slug=weinfreunde</code>
        <br />
        Nach Join geht’s weiter zu: <code>/t/{"{slug}"}</code>
      </p>
    </main>
  );
}
