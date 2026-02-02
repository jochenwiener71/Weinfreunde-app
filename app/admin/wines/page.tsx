"use client";

import { useMemo, useRef, useState } from "react";

type WineSlot = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;

  // NEW (optional in response; falls API es noch nicht liefert, bleibt es einfach null)
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

export default function AdminWinesPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [publicSlug, setPublicSlug] = useState("");

  const [data, setData] = useState<AdminGetTastingResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // local editable copy
  const [rows, setRows] = useState<WineSlot[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Upload state
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileMapRef = useRef<Record<string, File | null>>({}); // wineId -> file

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
      setRows(
        (json.wines ?? [])
          .slice()
          .sort((a: WineSlot, b: WineSlot) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999))
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

  function onPickFile(wineId: string, file: File | null) {
    fileMapRef.current[wineId] = file;
  }

  async function uploadImage(r: WineSlot) {
    const file = fileMapRef.current[r.id];
    if (!file) {
      setMsg("Bitte zuerst ein Bild auswählen.");
      return;
    }

    setMsg(null);
    setUploadingId(r.id);

    try {
      const fd = new FormData();
      fd.append("publicSlug", publicSlug.trim());
      fd.append("wineId", r.id);
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

      // update local row preview
      updateRow(r.id, {
        imageUrl: json.imageUrl ?? null,
        imagePath: json.imagePath ?? null,
      });

      // reset chosen file (optional)
      fileMapRef.current[r.id] = null;

      setMsg(`Bild hochgeladen: Wein ${r.blindNumber ?? "?"} ✅`);
    } catch (e: any) {
      setMsg(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Weine bearbeiten</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Trage Owner/Weingut/Rebsorte/Jahrgang ein und lade optional ein Flaschenfoto hoch. Nach „Reveal“ sind Details
        & Bild in Reporting/Ergebnis sichtbar.
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
            placeholder="publicSlug (z. B. weinfreunde)"
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
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                  <th style={{ textAlign: "left", padding: 10, width: 80 }}>Blind #</th>
                  <th style={{ textAlign: "right", padding: 10, width: 90 }}>Serve</th>
                  <th style={{ textAlign: "left", padding: 10, width: 160 }}>Owner</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Weingut</th>
                  <th style={{ textAlign: "left", padding: 10, width: 170 }}>Rebsorte</th>
                  <th style={{ textAlign: "left", padding: 10, width: 110 }}>Jahrgang</th>
                  <th style={{ textAlign: "left", padding: 10, width: 320 }}>Foto</th>
                  <th style={{ textAlign: "right", padding: 10, width: 140 }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
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
                          width: 70,
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

                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.12)",
                            overflow: "hidden",
                            background: "rgba(0,0,0,0.04)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            opacity: 0.8,
                          }}
                        >
                          {r.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.imageUrl}
                              alt="Bottle"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            "—"
                          )}
                        </div>

                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => onPickFile(r.id, e.target.files?.[0] ?? null)}
                        />

                        <button
                          onClick={() => uploadImage(r)}
                          disabled={!adminSecret.trim() || uploadingId === r.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(0,0,0,0.15)",
                          }}
                        >
                          {uploadingId === r.id ? "Upload..." : "Upload"}
                        </button>

                        {r.imageUrl && (
                          <a href={r.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                            Öffnen
                          </a>
                        )}
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                        Tipp: iPad Foto → funktioniert. Für schnelle Ladezeiten Bild eher klein halten.
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
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Hinweis: „Serve“ ist optional. Wenn du später die Reihenfolge anzeigen willst, sortieren wir nach serveOrder.
          </p>
        </section>
      )}
    </main>
  );
}
