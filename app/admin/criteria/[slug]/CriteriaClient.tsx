"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type Criterion = {
  id: string;
  name?: string | null;
  label?: string | null;
  weight?: number | null;
  order?: number | null;
  isActive?: boolean | null;
  [key: string]: any;
};

const SS_SECRET = "wf_admin_secret";

function btn(disabled?: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    border: "1px solid rgba(0,0,0,0.18)",
    borderRadius: 10,
    background: disabled ? "rgba(0,0,0,0.04)" : "white",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function pill(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "3px 8px",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 999,
    fontSize: 12,
    opacity: 0.8,
  };
}

function safeNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP ${res.status}` };
  }
}

export default function CriteriaClient({ slug }: { slug: string }) {
  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  // ✅ secret aus sessionStorage holen
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SS_SECRET) ?? "";
      if (saved) setAdminSecret(saved);
    } catch {
      // ignore
    }
  }, []);

  // ✅ secret speichern
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_SECRET, adminSecret);
    } catch {
      // ignore
    }
  }, [adminSecret]);

  const canLoad = useMemo(() => adminSecret.trim().length > 0, [adminSecret]);

  async function apiFetch(url: string, init?: RequestInit) {
    const headers: Record<string, string> = {
      ...(init?.headers as any),
      "x-admin-secret": adminSecret.trim(), // Header-Auth (falls API so prüft)
    };

    const res = await fetch(url, { ...init, headers, cache: "no-store" });
    const data = await readJson(res);

    if (!res.ok) {
      const err = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(err);
    }
    return data;
  }

  async function loadCriteria() {
    setLoading(true);
    setMsg(null);
    try {
      // ✅ WICHTIG: Viele deiner API-Versionen prüfen adminSecret in der Query.
      // Wir schicken daher BEIDES: Query + Header.
      const url =
        `/api/admin/list-criteria` +
        `?publicSlug=${encodeURIComponent(slug)}` +
        `&adminSecret=${encodeURIComponent(adminSecret.trim())}`;

      const data = await apiFetch(url);

      const arr: Criterion[] = Array.isArray(data?.criteria)
        ? data.criteria
        : Array.isArray(data)
        ? data
        : [];

      // Sort stabil (order -> label -> id)
      arr.sort((a, b) => {
        const ao = safeNum(a.order, 999999);
        const bo = safeNum(b.order, 999999);
        if (ao !== bo) return ao - bo;
        const al = String(a.label ?? a.name ?? "");
        const bl = String(b.label ?? b.name ?? "");
        if (al !== bl) return al.localeCompare(bl);
        return String(a.id).localeCompare(String(b.id));
      });

      setCriteria(arr);
      setMsg(`Geladen: ${arr.length} Kriterien ✅`);
    } catch (e: any) {
      setMsg(`Fehler: ${e?.message ?? "unbekannt"}`);
    } finally {
      setLoading(false);
    }
  }

  function patch(id: string, p: Partial<Criterion>) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  function addNew() {
    const newId = `new_${Math.random().toString(36).slice(2, 9)}`;
    setCriteria((prev) => [
      ...prev,
      {
        id: newId,
        label: "",
        weight: 1,
        order: prev.length + 1,
        isActive: true,
        _isNew: true,
      },
    ]);
  }

  async function saveCriterion(c: Criterion) {
    setLoading(true);
    setMsg(null);
    try {
      const payload = {
        publicSlug: slug,
        criterion: {
          id: c._isNew ? undefined : c.id,
          label: c.label ?? c.name ?? "",
          weight: safeNum(c.weight, 1),
          order: safeNum(c.order, 1),
          isActive: !!c.isActive,
        },
        // falls Route Body-check macht:
        adminSecret: adminSecret.trim(),
      };

      const data = await apiFetch(`/api/admin/upsert-criterion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const newId = data?.id || data?.criterion?.id;
      if (c._isNew && newId) {
        setCriteria((prev) => prev.map((x) => (x.id === c.id ? { ...x, id: newId, _isNew: false } : x)));
      } else {
        patch(c.id, { _isNew: false });
      }

      setMsg("Gespeichert ✅");
      await loadCriteria();
    } catch (e: any) {
      setMsg(`Fehler: ${e?.message ?? "unbekannt"}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteCriterion(c: Criterion) {
    if (!confirm(`Kriterium wirklich löschen?\n\n${c.label ?? c.name ?? c.id}`)) return;

    setLoading(true);
    setMsg(null);
    try {
      const payload = {
        publicSlug: slug,
        id: c._isNew ? undefined : c.id,
        adminSecret: adminSecret.trim(),
      };

      if (c._isNew) {
        setCriteria((prev) => prev.filter((x) => x.id !== c.id));
        setMsg("Entfernt (lokal) ✅");
        return;
      }

      await apiFetch(`/api/admin/delete-criterion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMsg("Gelöscht ✅");
      await loadCriteria();
    } catch (e: any) {
      setMsg(`Fehler: ${e?.message ?? "unbekannt"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1050, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Kategorien/Kriterien verwalten</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        publicSlug: <b>{slug}</b> <span style={{ marginLeft: 10, ...pill() }}>API: /api/admin/*</span>
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
        <Link
          href="/admin"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            textDecoration: "none",
          }}
        >
          ← Admin Dashboard
        </Link>

        <button type="button" onClick={addNew} style={btn(false)} disabled={!canLoad}>
          + Neues Kriterium
        </button>

        <button type="button" onClick={loadCriteria} style={btn(false)} disabled={!canLoad || loading}>
          {loading ? "Lade…" : "Kriterien laden"}
        </button>

        <span style={{ opacity: 0.7, fontSize: 13 }}>{criteria.length ? `Aktuell: ${criteria.length}` : ""}</span>
      </div>

      <section style={{ marginTop: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 14 }}>
        <label style={{ display: "block", fontSize: 12, opacity: 0.7 }}>ADMIN_SECRET</label>
        <input
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="mysecret"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
          autoCapitalize="none"
          autoCorrect="off"
        />

        {msg && <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, opacity: 0.85 }}>{msg}</p>}
      </section>

      <section style={{ marginTop: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "90px 1.3fr 110px 110px 120px 170px",
            gap: 8,
            padding: "10px 12px",
            borderBottom: "1px solid rgba(0,0,0,0.12)",
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          <div>ID</div>
          <div>Label</div>
          <div>Weight</div>
          <div>Order</div>
          <div>Aktiv</div>
          <div>Aktion</div>
        </div>

        {criteria.map((c) => (
          <div
            key={c.id}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1.3fr 110px 110px 120px 170px",
              gap: 8,
              padding: "10px 12px",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8, wordBreak: "break-all" }}>{c._isNew ? "NEW" : c.id}</div>

            <input
              value={String(c.label ?? c.name ?? "")}
              onChange={(e) => patch(c.id, { label: e.target.value })}
              placeholder="z.B. Aroma / Nase"
              style={{ width: "100%", padding: 8 }}
            />

            <input
              value={String(c.weight ?? 1)}
              onChange={(e) => patch(c.id, { weight: Number(e.target.value) })}
              type="number"
              step="0.1"
              style={{ width: "100%", padding: 8 }}
            />

            <input
              value={String(c.order ?? 1)}
              onChange={(e) => patch(c.id, { order: Number(e.target.value) })}
              type="number"
              step="1"
              style={{ width: "100%", padding: 8 }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!c.isActive}
                onChange={(e) => patch(c.id, { isActive: e.target.checked })}
              />
              aktiv
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" style={btn(false)} disabled={loading || !canLoad} onClick={() => saveCriterion(c)}>
                Speichern
              </button>
              <button type="button" style={btn(false)} disabled={loading || !canLoad} onClick={() => deleteCriterion(c)}>
                Löschen
              </button>
            </div>
          </div>
        ))}

        {!criteria.length && (
          <p style={{ marginTop: 14, opacity: 0.7 }}>Noch keine Kriterien geladen. ADMIN_SECRET eintragen → „Kriterien laden“.</p>
        )}
      </section>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
        Hinweis: Diese UI ruft <code>/api/admin/list-criteria</code>, <code>/api/admin/upsert-criterion</code>,{" "}
        <code>/api/admin/delete-criterion</code> auf und sendet das Secret als Header <code>x-admin-secret</code> und
        bei <code>list-criteria</code> zusätzlich als Query <code>adminSecret</code> (Fallback).
      </p>
    </main>
  );
}
