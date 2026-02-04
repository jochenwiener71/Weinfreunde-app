"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Participant = {
  id: string;
  name: string | null;
  isActive: boolean;
};

export default function ParticipantsClient({ slug }: { slug: string }) {
  const [adminSecret, setAdminSecret] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canLoad = useMemo(() => {
    return adminSecret.trim().length > 0;
  }, [adminSecret]);

  async function loadParticipants() {
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch(
        `/api/admin/list-participants?publicSlug=${encodeURIComponent(slug)}`,
        {
          headers: { "x-admin-secret": adminSecret.trim() },
        }
      );

      const json = await res.json();

      if (!res.ok) throw new Error(json?.error ?? "Fehler");

      setParticipants(json.participants ?? []);
      setMsg("Teilnehmer geladen ✅");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeParticipant(id: string) {
    try {
      await fetch("/api/admin/delete-participant", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ publicSlug: slug, participantId: id }),
      });

      setParticipants((p) => p.filter((x) => x.id !== id));
    } catch {
      alert("Löschen fehlgeschlagen");
    }
  }

  return (
    <>
      <section style={{ marginTop: 20 }}>
        <input
          placeholder="ADMIN_SECRET"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          style={{ padding: 10, width: 260 }}
        />

        <button
          onClick={loadParticipants}
          disabled={!canLoad || loading}
          style={{ marginLeft: 10 }}
        >
          Laden
        </button>

        {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
      </section>

      <section style={{ marginTop: 20 }}>
        {participants.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ccc",
              padding: 10,
              marginBottom: 8,
              borderRadius: 8,
            }}
          >
            <b>{p.name ?? "Unbenannt"}</b>

            <button
              onClick={() => removeParticipant(p.id)}
              style={{ marginLeft: 10 }}
            >
              Löschen
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
