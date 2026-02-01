"use client";

import { useMemo, useState } from "react";

type Criterion = { label: string; scaleMin: number; scaleMax: number };

export default function AdminHomePage() {
  // Shared inputs (für Links/Tests + Admin-Calls)
  const [adminSecret, setAdminSecret] = useState("");
  const [publicSlug, setPublicSlug] = useState("");

  // Quick Create inputs
  const [title, setTitle] = useState("");
  const [hostName, setHostName] = useState("");
  const [date, setDate] = useState(""); // ✅ NEW (YYYY-MM-DD)
  const [pin, setPin] = useState("");
  const [wineCount, setWineCount] = useState(8);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [status, setStatus] = useState<"draft" | "open" | "closed" | "revealed">("open");

  const [criteria, setCriteria] = useState<Criterion[]>([
    { label: "Nase", scaleMin: 1, scaleMax: 10 },
    { label: "Gaumen", scaleMin: 1, scaleMax: 10 },
    { label: "Balance", scaleMin: 1, scaleMax: 10 },
    { label: "Gesamteindruck", scaleMin: 1, scaleMax: 10 },
  ]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const slug = useMemo(() => publicSlug.trim(), [publicSlug]);

  const resultsLink = useMemo(() => {
    if (!slug) return "";
    return `/t/${encodeURIComponent(slug)}?admin=1`;
  }, [slug]);

  const apiSummary = useMemo(() => {
    if (!slug) return "";
    return `/api/tasting/summary?publicSlug=${encodeURIComponent(slug)}`;
  }, [slug]);

  const apiWines = useMemo(() => {
    if (!slug) return "";
    return `/api/tasting/wines?publicSlug=${encodeURIComponent(slug)}`;
  }, [slug]);

  const apiAdminGetTasting = useMemo(() => {
    if (!slug) return "";
    return `/api/admin/get-tasting?publicSlug=${encodeURIComponent(slug)}`;
  }, [slug]);

  const canQuickCreate = useMemo(() => {
    if (!adminSecret.trim()) return false;
    if (!slug) return false;
    if (!title.trim()) return false;
    if (!hostName.trim()) return false;
    if (!/^\d{4}$/.test(pin.trim())) return false;
    if (date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return false; // ✅ NEW
    if (wineCount < 1 || wineCount > 10) return false;
    if (maxParticipants < 1 || maxParticipants > 10) return false;
    const validCriteria = criteria.filter((c) => c.label.trim().length > 0);
    if (validCriteria.length < 1 || validCriteria.length > 8) return false;
    return true;
  }, [adminSecret, slug, title, hostName, pin, date, wineCount, maxParticipants, criteria]);

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

  async function quickCreate() {
    setMsg(null);
    setResult(null);
    setLoading(true);

    try {
      const body = {
        publicSlug: slug,
        title: title.trim(),
        hostName: hostName.trim(),
        date: date.trim() || null, // ✅ NEW
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
      };

      const res = await fetch("/api/admin/create-tasting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `HTTP ${res.status}` };
      }

      if (!res.ok) throw new Error(data?.error ? String(data.error) : `HTTP ${res.status}`);

      setResult(data);
      setMsg("Tasting erstellt ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1050, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Weinfreunde Tasting App</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Zentrale Admin-Seite: Quick Create + Links zu Verwaltung/Weinen/Reporting.
      </p>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Admin & Tasting Kontext</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <label style={{ display: "block" }}>
            ADMIN_SECRET (Pflicht für Admin Aktionen)
            <input
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="ADMIN_SECRET"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
            />
          </label>

          <label style={{ display: "block" }}>
            publicSlug (Pflicht)
            <input
              value={publicSlug}
              onChange={(e) => setPublicSlug(e.target.value)}
              placeholder="z. B. weinfreunde"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          <a
            href="/admin/tastings"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none", color: "inherit" }}
          >
            🗂️ Tastings verwalten
          </a>

          <a
            href="/admin/wines"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none", color: "inherit" }}
          >
            🍷 Weine verwalten
          </a>

          <a
            href="/admin/reporting"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none", color: "inherit" }}
          >
            📈 Reporting konfigurieren
          </a>

          <a
            href={resultsLink || "#"}
            onClick={(e) => {
              if (!resultsLink) {
                e.preventDefault();
                alert("Bitte publicSlug eintragen, um das Reporting zu öffnen.");
              }
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              textDecoration: "none",
              color: "inherit",
              opacity: resultsLink ? 1 : 0.6,
            }}
          >
            📊 Reporting (Ergebnis-Seite)
          </a>
        </div>
      </section>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Quick Create · Tasting anlegen</h2>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Erstellt ein Tasting inkl. Kriterien & Weinslots.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <label style={{ display: "block" }}>
            Titel
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sizilien Blind Tasting"
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
            />
          </label>

          <label style={{ display: "block" }}>
            Gastgeber
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Jochen"
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
            />
          </label>

          <label style={{ display: "block" }}>
            Datum (YYYY-MM-DD)
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="2026-02-01"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
            />
          </label>

          <label style={{ display: "block" }}>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
            >
              <option value="draft">draft</option>
              <option value="open">open</option>
              <option value="closed">closed</option>
              <option value="revealed">revealed</option>
            </select>
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
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
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
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
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
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
            />
          </label>
        </div>

        <hr style={{ marginTop: 16, opacity: 0.2 }} />

        <h3 style={{ margin: "8px 0", fontSize: 14 }}>Kriterien (max 8)</h3>

        {criteria.map((c, i) => (
          <div
            key={i}
            style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: 12, marginBottom: 10 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10 }}>
              <label style={{ display: "block" }}>
                Label
                <input
                  value={c.label}
                  onChange={(e) => updateCriterion(i, { label: e.target.value })}
                  style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
                />
              </label>

              <label style={{ display: "block" }}>
                Min
                <input
                  type="number"
                  value={c.scaleMin}
                  onChange={(e) => updateCriterion(i, { scaleMin: Number(e.target.value) })}
                  style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
                />
              </label>

              <label style={{ display: "block" }}>
                Max
                <input
                  type="number"
                  value={c.scaleMax}
                  onChange={(e) => updateCriterion(i, { scaleMax: Number(e.target.value) })}
                  style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
                />
              </label>

              <button
                onClick={() => removeCriterion(i)}
                disabled={criteria.length <= 1}
                style={{ padding: "10px 12px", height: 44, alignSelf: "end", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
                title="Entfernen"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={addCriterion}
            disabled={criteria.length >= 8}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)" }}
          >
            + Kriterium hinzufügen
          </button>

          <button
            onClick={quickCreate}
            disabled={!canQuickCreate || loading}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontWeight: 600 }}
          >
            {loading ? "Erstelle..." : "✅ Tasting erstellen"}
          </button>
        </div>

        {msg && (
          <p style={{ marginTop: 12, color: msg.includes("✅") ? "inherit" : "crimson", whiteSpace: "pre-wrap" }}>
            {msg}
          </p>
        )}

        {result && (
          <pre style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.06)", overflowX: "auto" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Debug / API Links (optional)</h2>

        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Public Summary</div>
            <a href={apiSummary || "#"} onClick={(e) => !apiSummary && e.preventDefault()} style={{ wordBreak: "break-all" }}>
              {apiSummary || "— (publicSlug fehlt)"}
            </a>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Public Wines</div>
            <a href={apiWines || "#"} onClick={(e) => !apiWines && e.preventDefault()} style={{ wordBreak: "break-all" }}>
              {apiWines || "— (publicSlug fehlt)"}
            </a>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Admin Get-Tasting (Header nötig)</div>
            <div style={{ wordBreak: "break-all" }}>{apiAdminGetTasting || "— (publicSlug fehlt)"}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
