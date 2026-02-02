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

  // ✅ NEW: bottle photo persisted in Firestore
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

export default function AdminWinesPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [publicSlug, setPublicSlug] = useState("");

  const [data, setData] = useState<AdminGetTastingResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // local editable copy
  const [rows, setRows] = useState<WineSlot[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

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

      // sort by blindNumber
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
      // ✅ IMPORTANT: include imageUrl + imagePath in body
      const body = {
        publicSlug: publicSlug.trim(),
        wineId: r.id,

        ownerName: r.ownerName,
        winery: r.winery,
        grape: r.grape,
        vintage: r.vintage,
        serveOrder: r.serveOrder,

        // ✅ NEW
        imageUrl: r.imageUrl ?? null,
        imagePath: r.imagePath ?? null,
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

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Weine bearbeiten</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Trage Owner/Weingut/Rebsorte/Jahrgang ein. Optional: Foto der Flasche (imageUrl/imagePath). Nach „Reveal“ werden
        diese Daten auf der Ergebnis-Seite sichtbar.
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
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1040 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                  <th style={{ textAlign: "left", padding: 10, width: 80 }}>Blind #</th>
                  <th style={{ textAlign: "right", padding: 10, width: 90 }}>Serve</th>
                  <th style={{ textAlign: "left", padding: 10, width: 180 }}>Owner</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Weingut</th>
                  <th style={{ textAlign: "left", padding: 10, width: 180 }}>Rebsorte</th>
                  <th style={{ textAlign: "left", padding: 10, width: 110 }}>Jahrgang</th>
                  <th style={{ textAlign: "left", padding: 10, width: 140 }}>Foto</th>
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

                    {/* ✅ Foto preview from persisted imageUrl */}
                    <td style={{ padding: 10 }}>
                      {r.imageUrl ? (
                        <img
                          src={r.imageUrl}
                          alt="Flasche"
                          style={{
                            width: 44,
                            height: 66,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid rgba(0,0,0,0.15)",
                            display: "block",
                          }}
                        />
                      ) : (
                        <span style={{ opacity: 0.6 }}>kein Bild</span>
                      )}
                      {/* optional tiny hint */}
                      {r.imagePath ? (
                        <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6, wordBreak: "break-all" }}>
                          {r.imagePath}
                        </div>
                      ) : null}
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
            Foto-Preview kommt aus <code>imageUrl</code> (persistiert in Firestore).
          </p>
        </section>
      )}
    </main>
  );
}
