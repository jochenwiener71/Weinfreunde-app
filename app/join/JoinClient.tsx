"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function JoinClient() {
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

      // Optional: Weiterleitung nach erfolgreichem Join
      // router.push(`/results?slug=${encodeURIComponent(slug.trim())}`);
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}>
      <h1>Weinfreunde · Join</h1>

      <label style={{ display: "block", marginTop: 14 }}>
        Tasting-Slug
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        PIN (4-stellig)
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          maxLength={4}
          inputMode="numeric"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        Vorname
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </label>

      <button
        onClick={submit}
        disabled={!canSubmit || loading}
        style={{ marginTop: 16, padding: 12, width: "100%" }}
      >
        {loading ? "Sende…" : "Registrieren"}
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
