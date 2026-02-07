"use client";

import { useMemo, useState } from "react";

type WineSlot = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;

  // bottle photo persisted in Firestore
  imageUrl: string | null;
  imagePath: string | null;
};

type AdminGetTastingResponse = {
  ok: boolean;
  tastingId: string;
  publicSlug: string;
  title: string | null;
  hostName: string | null;
  status: string | null;
  wineCount: number;
  wines: WineSlot[];
};

function maskPath(p: string) {
  if (!p) return "";
  if (p.length <= 34) return p;
  return `${p.slice(0, 16)}…${p.slice(-16)}`;
}

export default function AdminWinesPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [publicSlug, setPublicSlug] = useState("");

  const [data, setData] = useState<AdminGetTastingResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<WineSlot[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const canLoad = useMemo(
    () => adminSecret.trim().length > 0 && publicSlug.trim().length > 0,
    [adminSecret, publicSlug]
  );

  function updateRow(wineId: string, patch: Partial<WineSlot>) {
    setRows((prev) => prev.map((r) => (r.id === wineId ? { ...r, ...patch } : r)));
  }

  async function load() {
    setMsg(null);
    setLoading(true);
    setData(null);

    try {
      const res = await fetch(
        `/api/admin/get-tasting?publicSlug=${encodeURIComponent(publicSlug.trim())}`,
        {
          headers: { "x-admin-secret": adminSecret.trim() },
          cache: "no-store",
        }
      );

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setData(json);
      setRows(
        (json.wines ?? []).slice().sort(
          (a: WineSlot, b: WineSlot) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999)
        )
      );

      setMsg("Geladen ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function saveRow(r: WineSlot) {
    setMsg(null);
    setSavingId(r.id);

    try {
      const res = await fetch("/api/admin/update-wine", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          publicSlug: publicSlug.trim(),
          wineId: r.id,
          ownerName: r.ownerName,
          winery: r.winery,
          grape: r.grape,
          vintage: r.vintage,
          serveOrder: r.serveOrder,
          imageUrl: r.imageUrl ?? null,
          imagePath: r.imagePath ?? null,
        }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setMsg(`Gespeichert: Wein ${r.blindNumber ?? "?"} ✅`);
    } catch (e: any) {
      setMsg(e?.message ?? "Speichern fehlgeschlagen");
    } finally {
      setSavingId(null);
    }
  }

  async function onPickFile(wineId: string, file: File | null) {
    if (!file) return;

    setMsg(null);
    setUploadingId(wineId);

    try {
      const fd = new FormData();
      fd.append("publicSlug", publicSlug.trim());
      fd.append("wineId", wineId);
      fd.append("file", file);

      const res = await fetch("/api/admin/upload-wine-photo", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret.trim() },
        body: fd,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      updateRow(wineId, {
        imageUrl: json.imageUrl ?? null,
        imagePath: json.imagePath ?? null,
      });

      setMsg("Foto hochgeladen ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <h1>Admin · Weine bearbeiten</h1>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ padding: 10 }}
          />
          <input
            value={publicSlug}
            onChange={(e) => setPublicSlug(e.target.value)}
            placeholder="publicSlug (z. B. weinfreunde-feb26)"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ padding: 10 }}
          />
          <button onClick={load} disabled={!canLoad || loading}>
            {loading ? "Lade…" : "Laden"}
          </button>
        </div>

        {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
      </section>

      {rows.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Blind</th>
                <th>Owner</th>
                <th>Weingut</th>
                <th>Rebsorte</th>
                <th>Jahrgang</th>
                <th>Foto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #ddd" }}>
                  <td>{r.blindNumber}</td>
                  <td>
                    <input value={r.ownerName ?? ""} onChange={(e) => updateRow(r.id, { ownerName: e.target.value })} />
                  </td>
                  <td>
                    <input value={r.winery ?? ""} onChange={(e) => updateRow(r.id, { winery: e.target.value })} />
                  </td>
                  <td>
                    <input value={r.grape ?? ""} onChange={(e) => updateRow(r.id, { grape: e.target.value })} />
                  </td>
                  <td>
                    <input value={r.vintage ?? ""} onChange={(e) => updateRow(r.id, { vintage: e.target.value })} />
                  </td>
                  <td>
                    {r.imageUrl ? <img src={r.imageUrl} width={40} /> : "—"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingId === r.id}
                      onChange={(e) => onPickFile(r.id, e.target.files?.[0] ?? null)}
                    />
                    {r.imagePath && <div style={{ fontSize: 10 }}>{maskPath(r.imagePath)}</div>}
                  </td>
                  <td>
                    <button onClick={() => saveRow(r)} disabled={savingId === r.id}>
                      {savingId === r.id ? "…" : "Speichern"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
