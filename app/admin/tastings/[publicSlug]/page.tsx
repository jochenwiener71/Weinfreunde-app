"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WineSlot = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;
};

type AdminGetTastingResponse = {
  ok: true;
  tastingId: string;
  publicSlug: string;
  title: string | null;
  hostName: string | null;
  status: string | null;
  wineCount: number | null;
  maxParticipants: number | null;
  tastingDate?: string | null;
  wines: WineSlot[];
};

type ParticipantRow = {
  id: string;
  alias: string | null;
  createdAt?: string | null;
  ratingCount?: number | null;
};

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text };
  }
}

export default function AdminTastingDetailPage({
  params,
}: {
  params: { publicSlug: string };
}) {
  const publicSlug = decodeURIComponent(params.publicSlug || "");

  const [adminSecret, setAdminSecret] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [data, setData] = useState<AdminGetTastingResponse | null>(null);

  // meta edit
  const [editTitle, setEditTitle] = useState("");
  const [editHost, setEditHost] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMaxParticipants, setEditMaxParticipants] = useState<number>(10);

  // participants
  const [pLoading, setPLoading] = useState(false);
  const [pMsg, setPMsg] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);

  // Restore secret
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("WF_ADMIN_SECRET")
        : null;
    if (saved) setAdminSecret(saved);
  }, []);

  useEffect(() => {
    if (adminSecret.trim()) {
      window.localStorage.setItem("WF_ADMIN_SECRET", adminSecret.trim());
    }
  }, [adminSecret]);

  const canCall = useMemo(
    () => adminSecret.trim().length > 0,
    [adminSecret]
  );

  async function loadTasting() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/get-tasting?publicSlug=${encodeURIComponent(publicSlug)}`,
        {
          method: "GET",
          headers: { "x-admin-secret": adminSecret.trim() },
        }
      );

      const text = await res.text();
      const json = safeJsonParse(text);

      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      const t = json as AdminGetTastingResponse;
      setData(t);

      setEditTitle(String(t?.title ?? ""));
      setEditHost(String(t?.hostName ?? ""));
      setEditDate(String((t as any)?.tastingDate ?? ""));
      setEditMaxParticipants(Number(t?.maxParticipants ?? 10));

      setMsg("Tasting geladen ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(status: "open" | "closed" | "revealed" | "draft") {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ publicSlug, status }),
      });

      const text = await res.text();
      const json = safeJsonParse(text);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setMsg(`Status gesetzt: ${status} ✅`);
      await loadTasting();
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function saveMeta() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/update-tasting-meta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          publicSlug,
          title: editTitle.trim(),
          hostName: editHost.trim(),
          tastingDate: editDate.trim() || "",
          maxParticipants: Number(editMaxParticipants),
        }),
      });

      const text = await res.text();
      const json = safeJsonParse(text);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setMsg("Meta gespeichert ✅");
      await loadTasting();
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTasting() {
    const ok = window.confirm(
      `Wirklich löschen?\n\npublicSlug: ${publicSlug}\n\nAchtung: Subcollections (wines/criteria/ratings/participants) werden mit gelöscht.`
    );
    if (!ok) return;

    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/delete-tasting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ publicSlug }),
      });

      const text = await res.text();
      const json = safeJsonParse(text);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      window.location.href = "/admin/tastings";
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // Participants
  // =========================
  async function loadParticipants() {
    setPMsg(null);
    setPLoading(true);
    try {
      const res = await fetch(
        `/api/admin/list-participants?publicSlug=${encodeURIComponent(publicSlug)}`,
        {
          method: "GET",
          headers: { "x-admin-secret": adminSecret.trim() },
        }
      );

      const text = await res.text();
      const json = safeJsonParse(text);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      const rows = Array.isArray(json?.participants) ? json.participants : [];
      setParticipants(rows);
      setPMsg("Teilnehmer geladen ✅");
    } catch (e: any) {
      setPMsg(e?.message ?? "Fehler");
      setParticipants([]);
    } finally {
      setPLoading(false);
    }
  }

  async function deleteParticipant(participantId: string) {
    const ok = window.confirm(
      `Teilnehmer wirklich löschen?\n\nID: ${participantId}\n\nHinweis: Löschen entfernt den Teilnehmer und versucht außerdem seine Ratings zu löschen.`
    );
    if (!ok) return;

    setPMsg(null);
    setPLoading(true);
    try {
      const res = await fetch("/api/admin/delete-participant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ publicSlug, participantId }),
      });

      const text = await res.text();
      const json = safeJsonParse(text);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setPMsg("Teilnehmer gelöscht ✅");
      await loadParticipants();
    } catch (e: any) {
      setPMsg(e?.message ?? "Fehler");
    } finally {
      setPLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 980 }}>
      <h1 style={{ marginBottom: 6 }}>Admin · Tasting verwalten</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        <code>{publicSlug}</code>
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
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

      {/* Admin secret */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Admin</h2>

        <label style={{ display: "block" }}>
          ADMIN_SECRET
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="dein ADMIN_SECRET aus Vercel"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={loadTasting}
            disabled={!canCall || loading}
            style={{ padding: "10px 12px" }}
          >
            {loading ? "Lade..." : "Tasting laden"}
          </button>

          <button
            onClick={() => setStatus("open")}
            disabled={!canCall || loading}
            style={{ padding: "10px 12px" }}
          >
            Status: open
          </button>
          <button
            onClick={() => setStatus("closed")}
            disabled={!canCall || loading}
            style={{ padding: "10px 12px" }}
          >
            Status: closed
          </button>
          <button
            onClick={() => setStatus("revealed")}
            disabled={!canCall || loading}
            style={{ padding: "10px 12px" }}
          >
            Status: revealed
          </button>
          <button
            onClick={() => setStatus("draft")}
            disabled={!canCall || loading}
            style={{ padding: "10px 12px" }}
          >
            Status: draft
          </button>

          <button
            onClick={deleteTasting}
            disabled={!canCall || loading}
            style={{
              padding: "10px 12px",
              border: "1px solid crimson",
              color: "crimson",
              background: "transparent",
            }}
          >
            Löschen
          </button>
        </div>

        {msg && (
          <p style={{ marginTop: 12, color: msg.includes("✅") ? "inherit" : "crimson" }}>
            {msg}
          </p>
        )}
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      {/* Meta */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Meta-Daten</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "block" }}>
            Titel
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label style={{ display: "block" }}>
            Gastgeber
            <input
              value={editHost}
              onChange={(e) => setEditHost(e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label style={{ display: "block" }}>
            Tasting Datum (optional, z.B. 2026-02-01)
            <input
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>

          <label style={{ display: "block" }}>
            maxParticipants
            <input
              type="number"
              value={editMaxParticipants}
              onChange={(e) => setEditMaxParticipants(Number(e.target.value))}
              min={1}
              max={50}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>
        </div>

        <button
          onClick={saveMeta}
          disabled={!canCall || loading}
          style={{ padding: "10px 12px", marginTop: 12 }}
        >
          Meta speichern
        </button>

        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Hinweis: Speichern braucht den Endpoint <code>/api/admin/update-tasting-meta</code>.
        </p>
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      {/* Participants (integrated) */}
      <section id="participants">
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Teilnehmer</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={loadParticipants}
            disabled={!canCall || pLoading}
            style={{ padding: "10px 12px" }}
          >
            {pLoading ? "Lade..." : "Teilnehmer laden"}
          </button>
        </div>

        {pMsg && (
          <p style={{ marginTop: 10, color: pMsg.includes("✅") ? "inherit" : "crimson" }}>
            {pMsg}
          </p>
        )}

        {!participants.length ? (
          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
            Noch keine Teilnehmer geladen oder leer.
          </p>
        ) : (
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                    Alias
                  </th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                    ID
                  </th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                    Ratings
                  </th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                    Aktion
                  </th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {p.alias || <span style={{ opacity: 0.6 }}>(ohne Name)</span>}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      <code>{p.id}</code>
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {typeof p.ratingCount === "number" ? p.ratingCount : "-"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      <button
                        onClick={() => deleteParticipant(p.id)}
                        disabled={!canCall || pLoading}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid rgba(220,0,0,0.6)",
                          color: "crimson",
                          background: "transparent",
                          borderRadius: 6,
                        }}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Hinweis: Löschen entfernt den Teilnehmer und versucht außerdem seine Ratings zu löschen.
            </p>
          </div>
        )}
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      {/* Debug: current data */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Aktueller Stand (Debug)</h2>
        {!data ? (
          <p style={{ opacity: 0.7 }}>Noch nichts geladen.</p>
        ) : (
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: "rgba(0,0,0,0.06)",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
