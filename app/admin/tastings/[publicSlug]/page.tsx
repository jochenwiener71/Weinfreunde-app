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
  wines: WineSlot[];
};

export default function AdminTastingDetailPage({ params }: { params: { publicSlug: string } }) {
  const publicSlug = decodeURIComponent(params.publicSlug || "");

  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [data, setData] = useState<AdminGetTastingResponse | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editHost, setEditHost] = useState("");
  const [editDate, setEditDate] = useState(""); // optional, if you add tastingDate later
  const [editMaxParticipants, setEditMaxParticipants] = useState<number>(10);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("WF_ADMIN_SECRET") : null;
    if (saved) setAdminSecret(saved);
  }, []);

  useEffect(() => {
    if (adminSecret.trim()) window.localStorage.setItem("WF_ADMIN_SECRET", adminSecret.trim());
  }, [adminSecret]);

  const canCall = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/get-tasting?publicSlug=${encodeURIComponent(publicSlug)}`, {
        method: "GET",
        headers: { "x-admin-secret": adminSecret.trim() },
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setData(json as AdminGetTastingResponse);

      setEditTitle(String(json?.title ?? ""));
      setEditHost(String(json?.hostName ?? ""));
      setEditMaxParticipants(Number(json?.maxParticipants ?? 10));

      setMsg("Geladen ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
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
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setMsg(`Status gesetzt: ${status} ✅`);
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  // Optional: Update meta if you add endpoint later (see note below)
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
          tastingDate: editDate.trim() || "", // optional
          maxParticipants: Number(editMaxParticipants),
        }),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setMsg("Gespeichert ✅");
      await load();
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
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      window.location.href = "/admin/tastings";
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
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
        <Link href={`/admin/wines?publicSlug=${encodeURIComponent(publicSlug)}`}>Weine</Link>
        <a href={`/join?slug=${encodeURIComponent(publicSlug)}`} target="_blank" rel="noreferrer">
          Join-Link
        </a>
      </div>

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
          <button onClick={load} disabled={!canCall || loading} style={{ padding: "10px 12px" }}>
            {loading ? "Lade..." : "Tasting laden"}
          </button>

          <button onClick={() => setStatus("open")} disabled={!canCall || loading} style={{ padding: "10px 12px" }}>
            Status: open
          </button>
          <button onClick={() => setStatus("closed")} disabled={!canCall || loading} style={{ padding: "10px 12px" }}>
            Status: closed
          </button>
          <button onClick={() => setStatus("revealed")} disabled={!canCall || loading} style={{ padding: "10px 12px" }}>
            Status: revealed
          </button>
          <button onClick={() => setStatus("draft")} disabled={!canCall || loading} style={{ padding: "10px 12px" }}>
            Status: draft
          </button>

          <button
            onClick={deleteTasting}
            disabled={!canCall || loading}
            style={{ padding: "10px 12px", border: "1px solid crimson", color: "crimson" }}
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

        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
          Hinweis: Speichern braucht den Endpoint <code>/api/admin/update-tasting-meta</code> (siehe unten).
        </p>

        <button
          onClick={saveMeta}
          disabled={!canCall || loading}
          style={{ padding: "10px 12px", marginTop: 10 }}
        >
          Meta speichern
        </button>
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Aktueller Stand</h2>
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
