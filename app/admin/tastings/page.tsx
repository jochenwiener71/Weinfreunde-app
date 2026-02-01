"use client";

import { useEffect, useMemo, useState } from "react";

type TastingRow = {
  id: string;
  publicSlug: string | null;
  title: string | null;
  hostName: string | null;
  status: string | null;
  wineCount: number | null;
  maxParticipants: number | null;
  date: string | null;
  createdAt: any;
  updatedAt: any;
};

export default function AdminTastingsPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<TastingRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canLoad = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tastings", {
        headers: { "x-admin-secret": adminSecret.trim() },
        cache: "no-store",
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setRows(Array.isArray(data.tastings) ? data.tastings : []);
      setMsg(`Geladen ✅ (${(data.tastings ?? []).length} Tastings)`);
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(publicSlug: string | null, tastingId: string, status: "draft" | "open" | "closed" | "revealed") {
    setMsg(null);
    setBusyId(tastingId);
    try {
      const res = await fetch("/api/admin/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          tastingId, // bevorzugt (stabil)
          publicSlug: publicSlug ?? undefined,
          status,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setMsg(`Status gesetzt: ${status} ✅`);
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Status-Update fehlgeschlagen");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTasting(publicSlug: string | null, tastingId: string) {
    const label = publicSlug ? `${publicSlug} (${tastingId})` : tastingId;
    if (!confirm(`Wirklich löschen?\n\n${label}\n\nDas löscht auch wines/criteria/ratings/participants.`)) return;

    setMsg(null);
    setBusyId(tastingId);
    try {
      const res = await fetch("/api/admin/delete-tasting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ tastingId, publicSlug: publicSlug ?? undefined }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setMsg(`Gelöscht ✅ (deleted: ${data?.deletedCounts ? JSON.stringify(data.deletedCounts) : "ok"})`);
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    // optional: nicht auto-laden
  }, []);

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Tastings verwalten</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Liste, Status umschalten, Löschen, Links zu Reporting/Admin-Ansicht.
      </p>

      <section style={{ marginTop: 14, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
          />
          <button
            onClick={load}
            disabled={!canLoad || loading}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
          >
            {loading ? "Lade..." : "Laden"}
          </button>
        </div>

        {msg && (
          <p style={{ marginTop: 10, color: msg.includes("✅") ? "inherit" : "crimson", whiteSpace: "pre-wrap" }}>
            {msg}
          </p>
        )}
      </section>

      <section style={{ marginTop: 14 }}>
        <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                <th style={{ textAlign: "left", padding: 10 }}>publicSlug</th>
                <th style={{ textAlign: "left", padding: 10 }}>Titel</th>
                <th style={{ textAlign: "left", padding: 10 }}>Gastgeber</th>
                <th style={{ textAlign: "left", padding: 10 }}>Datum</th>
                <th style={{ textAlign: "right", padding: 10 }}>Weine</th>
                <th style={{ textAlign: "right", padding: 10 }}>Gäste</th>
                <th style={{ textAlign: "left", padding: 10 }}>Status</th>
                <th style={{ textAlign: "left", padding: 10, width: 380 }}>Aktionen</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((t) => {
                const slug = t.publicSlug ?? "";
                const id = t.id;
                const disabled = busyId === id;

                const reportUrl = slug ? `/t/${encodeURIComponent(slug)}?admin=1` : "";
                const publicUrl = slug ? `/t/${encodeURIComponent(slug)}` : "";

                return (
                  <tr key={id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                    <td style={{ padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {slug || <span style={{ opacity: 0.6 }}>—</span>}
                      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>id: {id}</div>
                    </td>
                    <td style={{ padding: 10 }}>{t.title ?? "—"}</td>
                    <td style={{ padding: 10 }}>{t.hostName ?? "—"}</td>
                    <td style={{ padding: 10 }}>{t.date ?? "—"}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{t.wineCount ?? "—"}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{t.maxParticipants ?? "—"}</td>
                    <td style={{ padding: 10 }}>{t.status ?? "—"}</td>

                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <button
                          onClick={() => setStatus(t.publicSlug, id, "draft")}
                          disabled={!adminSecret.trim() || disabled}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
                        >
                          Draft
                        </button>
                        <button
                          onClick={() => setStatus(t.publicSlug, id, "open")}
                          disabled={!adminSecret.trim() || disabled}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
                        >
                          Open
                        </button>
                        <button
                          onClick={() => setStatus(t.publicSlug, id, "closed")}
                          disabled={!adminSecret.trim() || disabled}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
                        >
                          Closed
                        </button>
                        <button
                          onClick={() => setStatus(t.publicSlug, id, "revealed")}
                          disabled={!adminSecret.trim() || disabled}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
                        >
                          Reveal
                        </button>

                        {slug ? (
                          <>
                            <a
                              href={reportUrl}
                              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none", color: "inherit" }}
                            >
                              Reporting
                            </a>
                            <a
                              href={publicUrl}
                              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none", color: "inherit", opacity: 0.9 }}
                            >
                              Public
                            </a>
                          </>
                        ) : null}

                        <button
                          onClick={() => deleteTasting(t.publicSlug, id)}
                          disabled={!adminSecret.trim() || disabled}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(0,0,0,0.15)",
                            color: "crimson",
                          }}
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!rows.length && (
                <tr>
                  <td colSpan={8} style={{ padding: 14, opacity: 0.7 }}>
                    Keine Tastings geladen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Hinweis: Löschen entfernt auch Subcollections (wines/criteria/ratings/participants).
        </p>
      </section>
    </main>
  );
}
