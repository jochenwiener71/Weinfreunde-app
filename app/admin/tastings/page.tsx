"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TastingListItem = {
  id: string;
  publicSlug: string;
  title: string;
  hostName: string;
  status: string;
  wineCount: number | null;
  maxParticipants: number | null;
  tastingDate?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export default function AdminTastingsPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [items, setItems] = useState<TastingListItem[]>([]);

  // Restore secret from localStorage (optional but practical)
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("WF_ADMIN_SECRET") : null;
    if (saved) setAdminSecret(saved);
  }, []);

  useEffect(() => {
    if (adminSecret.trim()) {
      window.localStorage.setItem("WF_ADMIN_SECRET", adminSecret.trim());
    }
  }, [adminSecret]);

  const canLoad = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/list-tastings", {
        method: "GET",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setItems(Array.isArray(data?.tastings) ? data.tastings : []);
      setMsg("Geladen ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 980 }}>
      <h1 style={{ marginBottom: 6 }}>Admin · Tastings</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Liste & Verwaltung deiner Tastings.
      </p>

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

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={load}
            disabled={!canLoad || loading}
            style={{ padding: "10px 12px" }}
          >
            {loading ? "Lade..." : "Tastings laden"}
          </button>

          <Link
            href="/admin/create"
            style={{
              padding: "10px 12px",
              border: "1px solid rgba(0,0,0,0.2)",
              borderRadius: 6,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            + Neues Tasting anlegen
          </Link>

          <Link
            href="/admin"
            style={{
              padding: "10px 12px",
              border: "1px solid rgba(0,0,0,0.2)",
              borderRadius: 6,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ← Dashboard
          </Link>
        </div>

        {msg && (
          <p style={{ marginTop: 12, color: msg.includes("✅") ? "inherit" : "crimson" }}>
            {msg}
          </p>
        )}
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tastings</h2>

        {!items.length ? (
          <p style={{ opacity: 0.7 }}>
            Noch keine Daten geladen – klicke „Tastings laden“.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Slug</th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Titel</th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Host</th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Status</th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Weine</th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Gäste</th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      <code>{t.publicSlug}</code>
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {t.title || <span style={{ opacity: 0.6 }}>(ohne Titel)</span>}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {t.hostName || <span style={{ opacity: 0.6 }}>(-)</span>}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      <code>{t.status || "-"}</code>
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {t.wineCount ?? "-"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {t.maxParticipants ?? "-"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Link href={`/admin/tastings/${encodeURIComponent(t.publicSlug)}`}>
                          Verwalten
                        </Link>
                        <Link href={`/admin/wines?publicSlug=${encodeURIComponent(t.publicSlug)}`}>
                          Weine
                        </Link>
                        <a
                          href={`/join?slug=${encodeURIComponent(t.publicSlug)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Join-Link
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
