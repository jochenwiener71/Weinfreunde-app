"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Participant = {
  id: string;
  name: string | null;
  isActive: boolean;
};

function btnStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    border: "1px solid rgba(0,0,0,0.18)",
    borderRadius: 10,
    background: disabled ? "rgba(0,0,0,0.04)" : "transparent",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

export default function ParticipantsClient({ slug }: { slug: string }) {
  const [adminSecret, setAdminSecret] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canLoad = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function loadParticipants() {
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/list-participants?publicSlug=${encodeURIComponent(slug)}`, {
        headers: { "x-admin-secret": adminSecret.trim() },
        cache: "no-store",
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      const list: Participant[] = Array.isArray(json?.participants) ? json.participants : [];
      setParticipants(list);
      setMsg(`Geladen: ${list.length} Teilnehmer ✅`);
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function deleteParticipant(p: Participant) {
    const displayName = p.name && p.name.trim() !== "" ? p.name : "(kein Name)";
    if (!confirm(`Teilnehmer wirklich löschen?\n\n${displayName}\nID: ${p.id}`)) return;

    setMsg(null);
    setDeletingId(p.id);

    try {
      // Variante A: DELETE mit Query Params (passt zu deiner API-Struktur im Repo)
      const res = await fetch(
        `/api/admin/delete-participant?publicSlug=${encodeURIComponent(slug)}&participantId=${encodeURIComponent(p.id)}`,
        {
          method: "DELETE",
          headers: { "x-admin-secret": adminSecret.trim() },
        }
      );

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setParticipants((prev) => prev.filter((x) => x.id !== p.id));
      setMsg("Gelöscht ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Teilnehmer verwalten</h1>
      <p style={{ marginTop: 6, opacity: 0.8 }}>
        publicSlug: <b>{slug}</b>
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <Link href="/admin" style={{ ...btnStyle(false), textDecoration: "none", color: "inherit" }}>
          ← Admin Dashboard
        </Link>
        <Link
          href={`/reporting/${encodeURIComponent(slug)}`}
          style={{ ...btnStyle(false), textDecoration: "none", color: "inherit" }}
        >
          📊 Reporting (public)
        </Link>
      </div>

      <section style={{ marginTop: 16, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 14 }}>
        <label style={{ display: "block" }}>
          ADMIN_SECRET
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
          />
        </label>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={loadParticipants} disabled={!canLoad || loading} style={btnStyle(!canLoad || loading)}>
            {loading ? "Lade..." : "Teilnehmer laden"}
          </button>
        </div>

        {msg && (
          <p style={{ marginTop: 10, color: msg.includes("✅") ? "inherit" : "crimson", whiteSpace: "pre-wrap" }}>
            {msg}
          </p>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                <th style={{ textAlign: "left", padding: 10 }}>Name</th>
                <th style={{ textAlign: "right", padding: 10, width: 140 }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const displayName = p.name && p.name.trim() !== "" ? p.name : "(kein Name)";
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                    <td style={{ padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{displayName}</div>

                      <div style={{ marginTop: 2, fontFamily: "ui-monospace", fontSize: 12, opacity: 0.75 }}>
                        ID: {p.id}
                      </div>

                      {!p.isActive ? (
                        <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>(inaktiv)</div>
                      ) : null}
                    </td>

                    <td style={{ padding: 10, textAlign: "right" }}>
                      <button
                        onClick={() => deleteParticipant(p)}
                        disabled={!adminSecret.trim() || deletingId === p.id}
                        style={btnStyle(!adminSecret.trim() || deletingId === p.id)}
                      >
                        {deletingId === p.id ? "..." : "Löschen"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {participants.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ padding: 12, opacity: 0.7 }}>
                    Noch keine Daten geladen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
