"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: slug.trim().toLowerCase(),
          name: name.trim(),
          pin: pin.trim(),
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error ?? "Login fehlgeschlagen");
        setLoading(false);
        return;
      }

      router.push(`/t/${slug.trim().toLowerCase()}`);
    } catch (e: any) {
      setError("Netzwerkfehler");
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Weinprobe</h1>

      <form onSubmit={handleJoin}>
        <div>
          <label>Runde (Slug)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Dein Vorname</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label>PIN (4-stellig)</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Bitte warten..." : "Beitreten"}
        </button>

        {error && (
          <p style={{ color: "red", marginTop: 10 }}>{error}</p>
        )}
      </form>
    </main>
  );
}
