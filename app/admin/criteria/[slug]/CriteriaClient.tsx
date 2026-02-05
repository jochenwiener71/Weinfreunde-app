"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Criterion = {
  id: string;
  title: string;
  weight: number;
  order: number;
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

      const sorted = [...(data.criteria || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );

      setCriteria(sorted);
      setMsg(`Geladen: ${sorted.length} Kriterien ✅`);
    } catch (e: any) {
      setMsg(`Fehler: ${e?.message || "unbekannt"}`);
    } finally {
      setLoading(false);
    }
  }

  function addCriterion() {
    const nextOrder =
      (criteria[criteria.length - 1]?.order ?? criteria.length) + 1;

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
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
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
          weight: Number(c.weight ?? 0),
          order: Number(c.order ?? 0),
          isActive: !!c.isActive,
        },
      };

      const data = await api<{ criterion: Criterion }>(
        `/api/admin/upsert-criterion`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      setCriteria((prev) =>
        prev.map((x) => (x.id === c.id ? data.criterion : x))
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
      <h1>Admin · Kategorien/Kriterien verwalten</h1>

      <p>
        publicSlug: <strong>{slug}</strong>
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Link href="/admin" style={btnStyle(false)}>
          ← Admin Dashboard
        </Link>

        <button
          onClick={loadCriteria}
          disabled={!canLoad || loading}
          style={btnStyle(!canLoad || loading)}
        >
          Kriterien laden
        </button>

        <button
          onClick={addCriterion}
          disabled={loading}
          style={btnStyle(loading)}
        >
          + Kriterium hinzufügen
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label>
          ADMIN_SECRET
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
      </div>

      <table style={{ width: "100%", marginTop: 20 }}>
        <thead>
          <tr>
            <th>Order</th>
            <th>Titel</th>
            <th>Gewicht</th>
            <th>Aktiv</th>
            <th>Aktion</th>
          </tr>
        </thead>

        <tbody>
          {criteria.map((c) => (
            <tr key={c.id}>
              <td>
                <input
                  type="number"
                  value={c.order}
                  onChange={(e) =>
                    updateLocal(c.id, { order: Number(e.target.value) })
                  }
                />
              </td>

              <td>
                <input
                  value={c.title}
                  onChange={(e) =>
                    updateLocal(c.id, { title: e.target.value })
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  value={c.weight}
                  onChange={(e) =>
                    updateLocal(c.id, { weight: Number(e.target.value) })
                  }
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  checked={c.isActive}
                  onChange={(e) =>
                    updateLocal(c.id, { isActive: e.target.checked })
                  }
                />
              </td>

              <td>
                <button onClick={() => saveCriterion(c)}>Speichern</button>
                <button onClick={() => deleteCriterion(c.id)}>
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
