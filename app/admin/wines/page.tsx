"use client";

import { useEffect, useMemo, useState } from "react";

type WineSlot = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;

  // NEW:
  imageUrl?: string | null;
  imagePath?: string | null;
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

function isHttpUrl(s: any) {
  if (typeof s !== "string") return false;
  return s.startsWith("http://") || s.startsWith("https://");
}

export default function AdminWinesPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [publicSlug, setPublicSlug] = useState("");

  const [data, setData] = useState<AdminGetTastingResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // local editable copy
  const [rows, setRows] = useState<WineSlot[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  // NEW: file selection per wine
  const [fileByWineId, setFileByWineId] = useState<Record<string, File | null>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Restore admin secret
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("WF_ADMIN_SECRET") : null;
    if (saved) setAdminSecret(saved);
  }, []);

  useEffect(() => {
    if (adminSecret.trim()) window.localStorage.setItem("WF_ADMIN_SECRET", adminSecret.trim());
  }, [adminSecret]);

  const canLoad = useMemo(() => {
    return adminSecret.trim().length > 0 && publicSlug.trim().length > 0;
  }, [adminSecret, publicSlug]);

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
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setData(json);

      const wines = (json.wines ?? []).slice().sort((a: WineSlot, b: WineSlot) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999));
      setRows(wines);

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
      const body = {
        publicSlug: publicSlug.trim(),
        wineId: r.id,
        ownerName: r.ownerName,
        winery: r.winery,
        grape: r.grape,
        vintage: r.vintage,
        serveOrder: r.serveOrder,
      };

      const res = await fetch("/api/admin/update-wine", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setMsg(`Gespeichert: Wein ${r.blindNumber ?? "?"} ✅`);
    } catch (e: any) {
      setMsg(e?.message ?? "Speichern fehlgeschlagen");
    } finally {
      setSavingId(null);
    }
  }

  async function uploadImage(wine: WineSlot) {
    const file = fileByWineId[wine.id];
    if (!file) {
      setMsg("Bitte zuerst ein Bild auswählen.");
      return;
    }

    setMsg(null);
    setUploadingId(wine.id);

    try {
      const fd = new FormData();
      fd.append("publicSlug", publicSlug.trim());
      fd.append("wineId", wine.id);
      fd.append("file", file);

      const res = await fetch("/api/admin/upload-wine-image", {
        method: "POST",
        headers: {
          "x-admin-secret": adminSecret.trim(),
        },
        body: fd,
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      // Update local row preview immediately
      updateRow(wine.id, {
        imageUrl: json?.imageUrl ?? null,
        imagePath: json?.imagePath ?? null,
      });

      // Clear chosen file
      setFileByWineId((prev) => ({ ...prev, [wine.id]: null }));

      setMsg(`Bild hochgeladen: Wein ${wine.blindNumber ?? "?"} ✅`);
    } catch (e: any) {
      setMsg(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1180, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Weine bearbeiten</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Trage Owner/Weingut/Rebsorte/Jahrgang ein und lade optional ein Flaschenfoto hoch. Nach „Reveal“ werden Details sichtbar.
      </p>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
          />
          <input
            value={publicSlug}
            onChange={(e) => setPublicSlug(e.target.value)}
            placeholder="publicSlug (z. B. weinfreunde-feb26)"
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

        {data && (
          <p style={{ marginTop: 10, opacity: 0.8 }}>
            <b>{data.title ?? data.publicSlug}</b> · Gastgeber: {data.hostName ?? "—"} · Status:{" "}
            <b>{data.status ?? "—"}</b>
          </p>
        )}

        {msg && (
          <p style={{ marginTop: 10, color: msg.includes("✅") ? "inherit" : "crimson", whiteSpace: "pre-wrap" }}>
            {msg}
          </p>
        )}
      </section>

      {rows.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                  <th style={{ textAlign: "left", padding: 10, width: 70 }}>Blind #</th>
                  <th style={{ textAlign: "right", padding: 10, width: 80 }}>Serve</th>
                  <th style={{ textAlign: "left", padding: 10, width: 170 }}>Owner</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Weingut</th>
                  <th style={{ textAlign: "left", padding: 10, width: 170 }}>Rebsorte</th>
                  <th style={{ textAlign: "left", padding: 10, width: 95 }}>Jahrgang</th>

                  {/* NEW */}
                  <th style={{ textAlign: "left", padding: 10, width: 330 }}>Flaschenfoto</th>

                  <th style={{ textAlign: "right", padding: 10, width: 140 }}>Aktion</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const previewUrl = isHttpUrl(r.imageUrl) ? (r.imageUrl as string) : "";
                  const selectedFile = fileByWineId[r.id] ?? null;

                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                      <td style={{ padding: 10 }}>
                        <b>{r.blindNumber ?? "—"}</b>
                      </td>

                      <td style={{ padding: 10, textAlign: "right" }}>
                        <input
                          type="number"
                          value={r.serveOrder ?? ""}
                          onChange={(e) =>
                            updateRow(r.id, {
                              serveOrder: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          style={{
                            width: 60,
                            padding: 8,
                            borderRadius: 8,
                            border: "1px solid rgba(0,0,0,0.2)",
                            textAlign: "right",
                          }}
                          placeholder="—"
                        />
                      </td>

                      <td style={{ padding: 10 }}>
                        <input
                          value={r.ownerName ?? ""}
                          onChange={(e) => updateRow(r.id, { ownerName: e.target.value || null })}
                          placeholder="Name"
                          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
                        />
                      </td>

                      <td style={{ padding: 10 }}>
                        <input
                          value={r.winery ?? ""}
                          onChange={(e) => updateRow(r.id, { winery: e.target.value || null })}
                          placeholder="Weingut"
                          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
                        />
                      </td>

                      <td style={{ padding: 10 }}>
                        <input
                          value={r.grape ?? ""}
                          onChange={(e) => updateRow(r.id, { grape: e.target.value || null })}
                          placeholder="Rebsorte"
                          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
                        />
                      </td>

                      <td style={{ padding: 10 }}>
                        <input
                          value={r.vintage ?? ""}
                          onChange={(e) => updateRow(r.id, { vintage: e.target.value || null })}
                          placeholder="z.B. 2019"
                          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
                        />
                      </td>

                      {/* NEW: Image upload */}
                      <td style={{ padding: 10 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          <div
                            style={{
                              width: 54,
                              height: 54,
                              borderRadius: 10,
                              border: "1px solid rgba(0,0,0,0.12)",
                              background: "rgba(0,0,0,0.04)",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                            title={previewUrl ? "Gespeichertes Bild" : "Kein Bild"}
                          >
                            {previewUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={previewUrl}
                                alt="Bottle"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <span style={{ fontSize: 12, opacity: 0.7 }}>—</span>
                            )}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 210 }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                setFileByWineId((prev) => ({ ...prev, [r.id]: f }));
                              }}
                            />

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                onClick={() => uploadImage(r)}
                                disabled={!adminSecret.trim() || !publicSlug.trim() || uploadingId === r.id || !selectedFile}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  border: "1px solid rgba(0,0,0,0.15)",
                                }}
                              >
                                {uploadingId === r.id ? "Lade hoch..." : "Upload"}
                              </button>

                              {previewUrl && (
                                <a
                                  href={previewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: 13, textDecoration: "underline" }}
                                >
                                  Öffnen
                                </a>
                              )}
                            </div>

                            {!!r.imagePath && (
                              <div style={{ fontSize: 12, opacity: 0.7 }}>
                                <code style={{ wordBreak: "break-all" }}>{r.imagePath}</code>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: 10, textAlign: "right" }}>
                        <button
                          onClick={() => saveRow(r)}
                          disabled={!adminSecret.trim() || savingId === r.id}
                          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
                        >
                          {savingId === r.id ? "Speichere..." : "Speichern"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Hinweis: Upload speichert <code>imageUrl</code> direkt am Wein-Dokument. „Speichern“ speichert Owner/Weingut/Rebsorte/Jahrgang/Serve.
          </p>
        </section>
      )}
    </main>
  );
}
