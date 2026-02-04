import Link from "next/link";

type Participant = {
  id: string;
  displayName: string | null;
  alias: string | null;
  createdAt: string | null; // ISO string (vom API)
};

async function apiGet<T>(url: string, adminSecret: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "x-admin-secret": adminSecret },
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
  return json as T;
}

async function apiDelete<T>(url: string, adminSecret: string): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "x-admin-secret": adminSecret },
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
  return json as T;
}

export default async function AdminParticipantsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // ✅ Admin-Secret kommt bei dir bisher oft per Input – hier machen wir es simpel:
  // Du gibst es als ?secret=... mit (oder du stellst es später auf ENV um).
  // Beispiel: /admin/participants/weinfreunde-feb26?secret=mysecret
  // (Ohne secret zeigen wir nur eine hilfreiche Meldung.)
  //
  // Next.js Server Component: searchParams sind hier NICHT automatisch drin,
  // deshalb machen wir es Client-seitig (unten) für UX.
  //
  // -> Wir rendern eine Client-Komponente inline.
  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Teilnehmer verwalten</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        publicSlug: <b>{slug}</b>
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <Link
          href="/admin"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ← Admin Dashboard
        </Link>

        <Link
          href={`/reporting/${encodeURIComponent(slug)}`}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          📊 Reporting (public)
        </Link>
      </div>

      {/* Client UI */}
      <ParticipantsClient slug={slug} />
    </main>
  );
}

/* ---------------- CLIENT PART ---------------- */

"use client";

import { useEffect, useMemo, useState } from "react";

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

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function safeStr(s: any): string | null {
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

function normalizeParticipant(p: any): Participant {
  return {
    id: String(p?.id ?? ""),
    displayName: safeStr(p?.displayName),
    alias: safeStr(p?.alias),
    createdAt: safeStr(p?.createdAt),
  };
}

function ParticipantsClient({ slug }: { slug: string }) {
  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Participant[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canLoad = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      // ✅ API Route erwartet publicSlug als Query (so wie deine anderen Admin-APIs)
      const url = `/api/admin/list-participants?publicSlug=${encodeURIComponent(slug)}`;
      const json: any = await apiGet(url, adminSecret.trim());

      const list = Array.isArray(json?.participants) ? json.participants : Array.isArray(json) ? json : [];
      setRows(list.map(normalizeParticipant));

      setMsg(`Geladen: ${list.length} Teilnehmer ✅`);
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  async function remove(p: Participant) {
    if (!adminSecret.trim()) return;
    if (!p?.id) return;

    const ok = confirm(`Teilnehmer löschen?\n\n${p.displayName ?? p.alias ?? p.id}`);
    if (!ok) return;

    setDeletingId(p.id);
    setMsg(null);

    try {
      const url = `/api/admin/delete-participant?publicSlug=${encodeURIComponent(slug)}&participantId=${encodeURIComponent(
        p.id
      )}`;
      await apiDelete(url, adminSecret.trim());

      setRows((prev) => prev.filter((x) => x.id !== p.id));
      setMsg("Teilnehmer gelöscht ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setDeletingId(null);
    }
  }

  // optional: autoload sobald secret gesetzt wird (nicht erzwingen)
  useEffect(() => {
    setRows([]);
    setMsg(null);
  }, [slug]);

  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
          />
          <button onClick={load} disabled={!canLoad || loading} style={btnStyle(!canLoad || loading)}>
            {loading ? "Lade..." : "Teilnehmer laden"}
          </button>
        </div>

        {msg && (
          <p style={{ marginTop: 10, whiteSpace: "pre-wrap", color: msg.includes("✅") ? "inherit" : "crimson" }}>
            {msg}
          </p>
        )}

        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Hinweis: Diese Seite nutzt <code>/api/admin/list-participants</code> und <code>/api/admin/delete-participant</code>.
        </p>
      </div>

      <div style={{ marginTop: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.04)" }}>
              <th style={{ textAlign: "left", padding: 10, width: 300 }}>Name / Alias</th>
              <th style={{ textAlign: "left", padding: 10 }}>ID</th>
              <th style={{ textAlign: "left", padding: 10, width: 220 }}>Erstellt</th>
              <th style={{ textAlign: "right", padding: 10, width: 140 }}>Aktion</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 12, opacity: 0.7 }}>
                  Noch keine Daten – gib dein ADMIN_SECRET ein und klicke „Teilnehmer laden“.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  <td style={{ padding: 10 }}>
                    <b>{p.displayName ?? p.alias ?? "—"}</b>
                    {p.displayName && p.alias ? (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Alias: {p.alias}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {p.id}
                  </td>
                  <td style={{ padding: 10 }}>{fmtDate(p.createdAt)}</td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    <button onClick={() => remove(p)} disabled={!canLoad || deletingId === p.id} style={btnStyle(!canLoad)}>
                      {deletingId === p.id ? "Lösche..." : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
