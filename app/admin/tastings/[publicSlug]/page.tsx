"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Participant = {
  id: string;
  alias: string | null;
  createdAt: string | null;
};

export default function AdminTastingParticipantsPage({
  params,
}: {
  params: { publicSlug: string };
}) {
  const publicSlug = decodeURIComponent(params.publicSlug);

  const [adminSecret, setAdminSecret] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("WF_ADMIN_SECRET");
    if (saved) setAdminSecret(saved);
  }, []);

  useEffect(() => {
    if (adminSecret.trim()) {
      window.localStorage.setItem("WF_ADMIN_SECRET", adminSecret.trim());
    }
  }, [adminSecret]);

  const canLoad = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function loadParticipants() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/list-participants?publicSlug=${encodeURIComponent(publicSlug)}`,
        {
          headers: {
            "x-admin-secret": adminSecret.trim(),
          },
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Load failed");

      setParticipants(json.participants ?? []);
      setMsg("Teilnehmer geladen ✅");
    } catch (e: any) {
      setMsg(e.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function deleteParticipant(id: string, alias: string | null) {
    if (!confirm(`Teilnehmer ${alias ?? id} wirklich löschen?`)) return;

    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/delete-participant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ publicSlug, participantId: id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");

      await loadParticipants();
    } catch (e: any) {
      setMsg(e.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1>Admin · Teilnehmer</h1>
      <p style={{ opacity: 0.7 }}>
        <code>{publicSlug}</code>
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link href="/admin/tastings">← Tastings</Link>
        <Link href={`/admin/wines?publicSlug=${encodeURIComponent(publicSlug)}`}>
          Weine
        </Link>
        <a
          href={`/join?slug=${encodeURIComponent(publicSlug)}`}
          target="_blank"
          rel="noreferrer"
        >
          Join-Link
        </a>
      </div>

      <label>
        ADMIN_SECRET
        <input
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </label>

      <button
        onClick={loadParticipants}
        disabled={!canLoad || loading}
        style={{ marginTop: 12, padding: "10px 12px" }}
      >
        {loading ? "Lade…" : "Teilnehmer laden"}
      </button>

      {msg && (
        <p style={{ marginTop: 10, color: msg.includes("✅") ? "inherit" : "crimson" }}>
          {msg}
        </p>
      )}

      <hr style={{ margin: "18px 0", opacity: 0.2 }} />

      {!participants.length ? (
        <p style={{ opacity: 0.6 }}>Keine Teilnehmer geladen.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Registriert</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id}>
                <td>{p.alias ?? "(ohne Namen)"}</td>
                <td style={{ fontSize: 12, opacity: 0.7 }}>
                  {p.createdAt ?? "-"}
                </td>
                <td>
                  <button
                    onClick={() => deleteParticipant(p.id, p.alias)}
                    style={{ color: "crimson" }}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
