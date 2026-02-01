"use client";

import { useEffect, useMemo, useState } from "react";

type Criterion = { label: string; scaleMin: number; scaleMax: number };

type WineMetaInput = {
  blindNumber: number; // 1..wineCount (blind)
  serveOrder: number | null; // Reihenfolge der Verkostung (optional)
  ownerName: string; // Person, die den Wein mitgebracht hat
  winery: string; // Weingut
  grape: string; // Rebsorte
  vintage: string; // Jahrgang (string ist flexibel: "2021", "NV", ...)
};

export default function AdminCreateTastingPage() {
  const [adminSecret, setAdminSecret] = useState("");

  const [publicSlug, setPublicSlug] = useState("");
  const [title, setTitle] = useState("");
  const [hostName, setHostName] = useState("");
  const [pin, setPin] = useState("");

  const [wineCount, setWineCount] = useState(10);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [status, setStatus] = useState<"draft" | "open" | "closed" | "revealed">("open");

  const [criteria, setCriteria] = useState<Criterion[]>([
    { label: "Nase", scaleMin: 1, scaleMax: 10 },
    { label: "Gaumen", scaleMin: 1, scaleMax: 10 },
    { label: "Balance", scaleMin: 1, scaleMax: 10 },
    { label: "Gesamteindruck", scaleMin: 1, scaleMax: 10 },
  ]);

  // ---------- 3A: Wines State ----------
  function makeInitialWines(count: number): WineMetaInput[] {
    return Array.from({ length: count }, (_, i) => ({
      blindNumber: i + 1,
      serveOrder: null,
      ownerName: "",
      winery: "",
      grape: "",
      vintage: "",
    }));
  }

  const [wines, setWines] = useState<WineMetaInput[]>(() => makeInitialWines(wineCount));

  // wenn wineCount geändert wird, Wines neu initialisieren
  useEffect(() => {
    setWines(makeInitialWines(wineCount));
  }, [wineCount]);

  function updateWine(blindNumber: number, patch: Partial<WineMetaInput>) {
    setWines((prev) => prev.map((w) => (w.blindNumber === blindNumber ? { ...w, ...patch } : w)));
  }
  // ------------------------------------

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const canSubmit = useMemo(() => {
    if (!adminSecret.trim()) return false;
    if (!publicSlug.trim()) return false;
    if (!title.trim()) return false;
    if (!hostName.trim()) return false;
    if (!/^\d{4}$/.test(pin.trim())) return false;
    if (wineCount < 1 || wineCount > 10) return false;
    if (maxParticipants < 1 || maxParticipants > 10) return false;
    const validCriteria = criteria.filter((c) => c.label.trim().length > 0);
    if (validCriteria.length < 1 || validCriteria.length > 8) return false;

    // optional: du kannst hier verlangen, dass ownerName gesetzt ist, sobald serveOrder gesetzt ist etc.
    return true;
  }, [adminSecret, publicSlug, title, hostName, pin, wineCount, maxParticipants, criteria]);

  function updateCriterion(i: number, patch: Partial<Criterion>) {
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addCriterion() {
    if (criteria.length >= 8) return;
    setCriteria((prev) => [...prev, { label: "Kriterium", scaleMin: 1, scaleMax: 10 }]);
  }

  function removeCriterion(i: number) {
    setCriteria((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setMsg(null);
    setResult(null);
    setLoading(true);

    try {
      const body = {
        publicSlug: publicSlug.trim(),
        title: title.trim(),
        hostName: hostName.trim(),
        pin: pin.trim(),
        wineCount,
        maxParticipants,
        status,
        criteria: criteria
          .map((c) => ({
            label: c.label.trim(),
            scaleMin: Number(c.scaleMin),
            scaleMax: Number(c.scaleMax),
          }))
          .filter((c) => c.label.length > 0),

        // ---------- 3A: wines ins Payload ----------
        wines: wines.map((w) => ({
          blindNumber: Number(w.blindNumber),
          serveOrder: w.serveOrder === null ? null : Number(w.serveOrder),
          ownerName: (w.ownerName ?? "").trim(),
          winery: (w.winery ?? "").trim(),
          grape: (w.grape ?? "").trim(),
          vintage: (w.vintage ?? "").trim(),
        })),
        // ------------------------------------------
      };

      const res = await fetch("/api/admin/create-tasting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify(body),
      });

      // ✅ Response nur EINMAL lesen (wichtig!)
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) {
        throw new Error(data?.error ? String(data.error) : `HTTP ${res.status}`);
      }

      setResult(data);
      setMsg("Tasting erstellt ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1 style={{ marginBottom: 6 }}>Admin · Tasting erstellen</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Erstellt ein Tasting inkl. Kriterien & Weinslots in Firestore.
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
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          Tipp: Secret wird nur im Browser genutzt und nicht gespeichert.
        </p>
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tasting Daten</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "block" }}>
            publicSlug
            <input
              value={publicSlug}
              onChange={(e) => setPublicSlug(e.target.value)}
              placeholder="weinrunde-2026-01-30"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>

          <label style={{ display: "block" }}>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            >
              <option value="draft">draft</option>
              <option value="open">open</option>
              <option value="closed">closed</option>
              <option value="revealed">revealed</option>
            </select>
          </label>

          <label style={{ display: "block" }}>
            Titel
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sizilien Blind Tasting"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label style={{ display: "block" }}>
            Gastgeber
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Jochen"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label style={{ display: "block" }}>
            PIN (4-stellig)
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label style={{ display: "block" }}>
            Weine (1–10)
            <input
              type="number"
              value={wineCount}
              min={1}
              max={10}
              onChange={(e) => setWineCount(Number(e.target.value))}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label style={{ display: "block" }}>
            Teilnehmer max (1–10)
            <input
              type="number"
              value={maxParticipants}
              min={1}
              max={10}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>
        </div>
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      {/* ---------- 3A: Wein-Admin-Eingaben ---------- */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Weine – Admin-Daten (pro Blindnummer)</h2>
        <p style={{ marginTop: 0, opacity: 0.75, fontSize: 13 }}>
          Optional: Reihenfolge & Wein-Infos kannst du auch erst während/nach der Verkostung ausfüllen.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {wines.map((w) => (
            <div
              key={w.blindNumber}
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Blind #{w.blindNumber}</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <label style={{ display: "block" }}>Reihenfolge</label>
                <input
                  type="number"
                  min={1}
                  max={wineCount}
                  value={w.serveOrder ?? ""}
                  onChange={(e) =>
                    updateWine(w.blindNumber, {
                      serveOrder: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="z.B. 3"
                  style={{ width: "100%", padding: 10 }}
                />

                <label style={{ display: "block" }}>Mitgebracht von</label>
                <input
                  value={w.ownerName}
                  onChange={(e) => updateWine(w.blindNumber, { ownerName: e.target.value })}
                  placeholder="Name"
                  style={{ width: "100%", padding: 10 }}
                />

                <label style={{ display: "block" }}>Weingut</label>
                <input
                  value={w.winery}
                  onChange={(e) => updateWine(w.blindNumber, { winery: e.target.value })}
                  placeholder="z.B. Pietradolce"
                  style={{ width: "100%", padding: 10 }}
                />

                <label style={{ display: "block" }}>Rebsorte</label>
                <input
                  value={w.grape}
                  onChange={(e) => updateWine(w.blindNumber, { grape: e.target.value })}
                  placeholder="z.B. Nerello Mascalese"
                  style={{ width: "100%", padding: 10 }}
                />

                <label style={{ display: "block" }}>Jahrgang</label>
                <input
                  value={w.vintage}
                  onChange={(e) => updateWine(w.blindNumber, { vintage: e.target.value })}
                  placeholder="z.B. 2021"
                  style={{ width: "100%", padding: 10 }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* -------------------------------------------- */}

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kriterien (max 8)</h2>

        {criteria.map((c, i) => (
          <div
            key={i}
            style={{
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10 }}>
              <label style={{ display: "block" }}>
                Label
                <input
                  value={c.label}
                  onChange={(e) => updateCriterion(i, { label: e.target.value })}
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label style={{ display: "block" }}>
                Min
                <input
                  type="number"
                  value={c.scaleMin}
                  onChange={(e) => updateCriterion(i, { scaleMin: Number(e.target.value) })}
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label style={{ display: "block" }}>
                Max
                <input
                  type="number"
                  value={c.scaleMax}
                  onChange={(e) => updateCriterion(i, { scaleMax: Number(e.target.value) })}
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <button
                onClick={() => removeCriterion(i)}
                disabled={criteria.length <= 1}
                style={{ padding: "10px 12px", height: 44, alignSelf: "end" }}
                title="Entfernen"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <button onClick={addCriterion} disabled={criteria.length >= 8} style={{ padding: "10px 12px" }}>
          + Kriterium hinzufügen
        </button>
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      <button
        onClick={submit}
        disabled={!canSubmit || loading}
        style={{ padding: "12px 14px", width: "100%", fontSize: 16 }}
      >
        {loading ? "Erstelle..." : "Tasting erstellen"}
      </button>

      {msg && <p style={{ marginTop: 12, color: msg.includes("✅") ? "inherit" : "crimson" }}>{msg}</p>}

      {result && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: "rgba(0,0,0,0.06)",
            overflowX: "auto",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      <p style={{ marginTop: 18, fontSize: 12, opacity: 0.7 }}>
        Danach kannst du auf die Startseite gehen und mit <code>publicSlug</code> + PIN beitreten.
      </p>
    </main>
  );
}
