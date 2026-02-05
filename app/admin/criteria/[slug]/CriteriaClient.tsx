"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Criterion = {
  id: string;
  title: string;
  weight: number; // 0..100 (oder dein Schema)
  order: number;  // Sortierung
  isActive: boolean;
};

function btnStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    border: "1px solid rgba(0,0,0,0.18)",
    borderRadius: 8,
    textDecoration: "none",
    color: "inherit",
    background: disabled ? "rgba(0,0,0,0.04)" : "transparent",
    opacity: disabled ? 0.55 : 1,
    pointerEvents: disabled ? "none" : "auto",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

export default function CriteriaClient({ slug }: { slug: string }) {
  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [criteria, setCriteria] = useState<Criterion[]>([]);

  const canLoad = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        "x-admin-secret": adminSecret.trim(),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return data as T;
  }

  async function loadCriteria() {
    if (!canLoad) return;
    setLoading(true);
    setMsg(null);
    try {
      const data = await api<{ criteria: Criterion[] }>(
        `/api/admin/list-criteria?publicSlug=${encodeURIComponent(slug)}`
      );
      const sorted = [...(data.criteria || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setCriteria(sorted);
      setMsg(`Geladen: ${sorted.length} Kriterien ✅`);
    } catch (e: any) {
      setMsg(`Fehler: ${e?.message || "unbekannt"}`);
    } finally {
      setLoading(false);
    }
  }

  function addCriterion() {
    const nextOrder = (criteria[criteria.length - 1]?.order ?? criteria.length) + 1;
    setCriteria((prev) => [
      ...prev,
      {
        id: `new_${Date.now()}`,
        title: "",
        weight: 20,
        order: nextOrder,
        isActive: true,
      },
    ]);
  }

  function updateLocal(id: string, patch: Partial<Criterion>) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function saveCriterion(c: Criterion) {
    setLoading(true);
    setMsg(null);
    try {
      const payload = {
        publicSlug: slug,
        criterion: {
          id: c.id.startsWith("new_") ? null : c.id,
          title: c.title.trim(),
          weight: Number.isFinite(c.weight) ? c.weight : 0,
          order: Number.isFinite(c.order) ? c.order : 0,
          isActive: !!c.isActive,
        },
      };

      const data = await api<{ criterion: Criterion }>(`/api/admin/upsert-criterion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      // falls "new_*" -> echte ID zurückkommt:
      setCriteria((prev) =>
        prev.map((x) => (x.id === c.id ? data.criterion : x)).sort((a, b) => a.order - b.order)
      );

      setMsg("Gespeichert ✅");
    } catch (e: any) {
      setMsg(`Fehler: ${e?.message || "unbekannt"}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteCriterion(id: string) {
    if (!confirm("Kriterium wirklich löschen?")) return;
    setLoading(true);
    setMsg(null);
    try {
      await api(`/api/admin/delete-criterion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicSlug: slug, id }),
      });
      setCriteria((prev) => prev.filter((c) => c.id !== id));
      setMsg("Gelöscht ✅");
    } catch (e: any) {
      setMsg(`Fehler: ${e?.message || "unbekannt"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>Admin · Kategorien/Kriterien verwalten</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>
        publicSlug: <strong>{slug}</strong>
      </p>

      <section style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/admin" style={btnStyle(false)}>
          ← Admin Dashboard
        </Link>

        <button onClick={loadCriteria} disabled={!canLoad || loading} style={btnStyle(!canLoad || loading)}>
          {loading ? "..." : "Kriterien laden"}
        </button>

        <button onClick={addCriterion} disabled={loading} style={btnStyle(loading)}>
          + Kriterium hinzufügen
        </button>
      </section>

      <section
        style={{
          marginTop: 14,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <label style={{ display: "block" }}>
          ADMIN_SECRET
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="mysecret"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        {msg && (
          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            {msg}
          </p>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
              <th style={{ padding: "10px 8px" }}>Order</th>
              <th style={{ padding: "10px 8px" }}>Titel</th>
              <th style={{ padding: "10px 8px" }}>Gewicht</th>
              <th style={{ padding: "10px 8px" }}>Aktiv</th>
              <th style={{ padding: "10px 8px" }}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                <td style={{ padding: "10px 8px", width: 90 }}>
                  <input
                    type="number"
                    value={c.order ?? 0}
                    onChange={(e) => updateLocal(c.id, { order: Number(e.target.value) })}
                    style={{ width: 70, padding: 8 }}
                  />
                </td>

                <td style={{ padding: "10px 8px" }}>
                  <input
                    value={c.title ?? ""}
                    onChange={(e) => updateLocal(c.id, { title: e.target.value })}
                    placeholder="z.B. Nase / Geschmack / Abgang"
                    style={{ width: "100%", padding: 8 }}
                  />
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>ID: {c.id}</div>
                </td>

                <td style={{ padding: "10px 8px", width: 140 }}>
                  <input
                    type="number"
                    value={c.weight ?? 0}
                    onChange={(e) => updateLocal(c.id, { weight: Number(e.target.value) })}
                    style={{ width: 110, padding: 8 }}
                  />
                </td>

                <td style={{ padding: "10px 8px", width: 90 }}>
                  <input
                    type="checkbox"
                    checked={!!c.isActive}
                    onChange={(e) => updateLocal(c.id, { isActive: e.target.checked })}
                  />
                </td>

                <td style={{ padding: "10px 8px", width: 220 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => saveCriterion(c)}
                      disabled={loading || !canLoad || !c.title.trim()}
                      style={btnStyle(loading || !canLoad || !c.title.trim())}
                    >
                      Speichern
                    </button>
                    <button onClick={() => deleteCriterion(c.id)} disabled={loading || !canLoad} style={btnStyle(loading || !canLoad)}>
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {criteria.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 14, opacity: 0.7 }}>
                  Keine Kriterien geladen. ADMIN_SECRET eingeben → „Kriterien laden“.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
