"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type CriterionInput = { label: string; scaleMin: number; scaleMax: number };
type ReportView = "ranking" | "table" | "spider" | "details";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminCreateClient() {
  const searchParams = useSearchParams();

  // ---- Admin Secret (lokal speichern) ----
  const [adminSecret, setAdminSecret] = useState("");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ADMIN_SECRET") : null;
    if (saved) setAdminSecret(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("ADMIN_SECRET", adminSecret);
  }, [adminSecret]);

  // ---- Form State ----
  const [publicSlug, setPublicSlug] = useState("");
  const [title, setTitle] = useState("");
  const [hostName, setHostName] = useState("");
  const [tastingDate, setTastingDate] = useState(""); // ISO-ish string, wir speichern als string
  const [pin, setPin] = useState("");
  const [wineCount, setWineCount] = useState<number>(8);
  const [maxParticipants, setMaxParticipants] = useState<number>(8);

  const [criteria, setCriteria] = useState<CriterionInput[]>([
    { label: "Nase", scaleMin: 1, scaleMax: 10 },
    { label: "Gaumen", scaleMin: 1, scaleMax: 10 },
    { label: "Balance", scaleMin: 1, scaleMax: 10 },
    { label: "Gesamteindruck", scaleMin: 1, scaleMax: 10 },
  ]);

  // Reporting UI Auswahl (nur UI/Meta – du kannst später serverseitig auswerten)
  const [reporting, setReporting] = useState<Record<ReportView, boolean>>({
    ranking: true,
    table: true,
    spider: false,
    details: true,
  });

  // ---- Query Param Prefill ----
  useEffect(() => {
    const qp = searchParams.get("publicSlug");
    if (qp) setPublicSlug(String(qp).trim());
  }, [searchParams]);

  // ---- Komfort: Auto-Slug aus Title/Host ----
  const suggestedSlug = useMemo(() => {
    const base = slugify(publicSlug || title || "");
    return base;
  }, [publicSlug, title]);

  // ---- UI State ----
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okInfo, setOkInfo] = useState<{ tastingId: string; publicSlug: string } | null>(null);

  function updateCriterion(idx: number, patch: Partial<CriterionInput>) {
    setCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeCriterion(idx: number) {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, { label: "", scaleMin: 1, scaleMax: 10 }]);
  }

  async function onSubmit() {
    setError(null);
    setOkInfo(null);

    const slug = String(publicSlug || suggestedSlug || "").trim();
    const t = String(title).trim();
    const h = String(hostName).trim();
    const p = String(pin).trim();

    if (!adminSecret.trim()) {
      setError("ADMIN Secret fehlt. Bitte oben eintragen (wird lokal gespeichert).");
      return;
    }
    if (!slug || !t || !h || !/^\d{4}$/.test(p)) {
      setError("Bitte Slug, Titel, Gastgeber ausfüllen und eine 4-stellige PIN setzen.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError("Slug ungültig: nur a-z, 0-9 und Bindestriche (lowercase).");
      return;
    }
    if (!Number.isInteger(wineCount) || wineCount < 1 || wineCount > 10) {
      setError("wineCount muss 1–10 sein.");
      return;
    }
    if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 10) {
      setError("maxParticipants muss 1–10 sein.");
      return;
    }
    const cleanedCriteria = criteria
      .map((c) => ({
        label: String(c.label ?? "").trim(),
        scaleMin: Number(c.scaleMin ?? 1),
        scaleMax: Number(c.scaleMax ?? 10),
      }))
      .filter((c) => c.label);

    if (cleanedCriteria.length < 1 || cleanedCriteria.length > 8) {
      setError("Bitte 1–8 Kategorien angeben (Labels dürfen nicht leer sein).");
      return;
    }
    if (cleanedCriteria.some((c) => !(c.scaleMin >= 1 && c.scaleMax >= c.scaleMin && c.scaleMax <= 10))) {
      setError("Skalen ungültig (z.B. 1–10).");
      return;
    }

    // Reporting Auswahl -> array
    const reportingViews = Object.entries(reporting)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setBusy(true);
    try {
      const res = await fetch("/api/admin/create-tasting", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({
          publicSlug: slug,
          title: t,
          hostName: h,
          pin: p,
          status: "open",
          wineCount,
          maxParticipants,
          criteria: cleanedCriteria,
          tastingDate: String(tastingDate ?? "").trim(), // wird aktuell als string gespeichert
          reportingViews, // UI/Meta
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Fehler (${res.status})`);
      }

      setOkInfo({ tastingId: data.tastingId, publicSlug: data.publicSlug || slug });
    } catch (e: any) {
      setError(e?.message ?? "Create fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1 style={{ marginBottom: 12 }}>Admin · Tasting erstellen</h1>

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Admin Secret (wird lokal gespeichert)</span>
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            style={{ width: "100%", padding: 10 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Tasting Titel</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Sizilien"
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Gastgeber</span>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="z.B. Jochen"
              style={{ width: "100%", padding: 10 }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Tasting Datum (frei, z.B. 2026-02-01 oder 01.02.2026)</span>
            <input
              value={tastingDate}
              onChange={(e) => setTastingDate(e.target.value)}
              placeholder="2026-02-01"
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>publicSlug (für QR/Join)</span>
            <input
              value={publicSlug}
              onChange={(e) => setPublicSlug(slugify(e.target.value))}
              placeholder="z.B. weinfreunde-feb26"
              style={{ width: "100%", padding: 10 }}
            />
            <small style={{ opacity: 0.8 }}>Empfohlen: {suggestedSlug || "—"}</small>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>PIN (4-stellig)</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              style={{ width: "100%", padding: 10 }}
              inputMode="numeric"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Anzahl Weine (1–10)</span>
            <input
              value={wineCount}
              onChange={(e) => setWineCount(Number(e.target.value))}
              type="number"
              min={1}
              max={10}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Anzahl Gäste (1–10)</span>
            <input
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              type="number"
              min={1}
              max={10}
              style={{ width: "100%", padding: 10 }}
            />
          </label>
        </div>
      </div>

      {/* Kriterien */}
      <section style={{ borderTop: "1px solid #eee", paddingTop: 16, marginTop: 16 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Bewertungskategorien</h2>
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          1–8 Kategorien, Skala z.B. 1–10.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {criteria.map((c, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <input
                value={c.label}
                onChange={(e) => updateCriterion(idx, { label: e.target.value })}
                placeholder="Label (z.B. Nase)"
                style={{ padding: 10 }}
              />
              <input
                value={c.scaleMin}
                onChange={(e) => updateCriterion(idx, { scaleMin: Number(e.target.value) })}
                type="number"
                min={1}
                max={10}
                style={{ padding: 10 }}
              />
              <input
                value={c.scaleMax}
                onChange={(e) => updateCriterion(idx, { scaleMax: Number(e.target.value) })}
                type="number"
                min={1}
                max={10}
                style={{ padding: 10 }}
              />
              <button
                type="button"
                onClick={() => removeCriterion(idx)}
                style={{ padding: "10px 12px" }}
                disabled={criteria.length <= 1}
                title={criteria.length <= 1 ? "Mindestens 1 Kategorie" : "Entfernen"}
              >
                Löschen
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addCriterion} style={{ marginTop: 10, padding: "10px 12px" }}>
          + Kategorie hinzufügen
        </button>
      </section>

      {/* Reporting */}
      <section style={{ borderTop: "1px solid #eee", paddingTop: 16, marginTop: 16 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Reporting anlegen (UI Auswahl)</h2>
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          Das ist erstmal eine UI-Auswahl/Meta. Später kannst du daraus konkrete Report-Seiten bauen.
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          {(["ranking", "table", "spider", "details"] as ReportView[]).map((k) => (
            <label key={k} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!reporting[k]}
                onChange={(e) => setReporting((p) => ({ ...p, [k]: e.target.checked }))}
              />
              <span>{k}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Submit */}
      <section style={{ borderTop: "1px solid #eee", paddingTop: 16, marginTop: 16 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          style={{
            padding: "12px 16px",
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Erstelle…" : "Tasting anlegen"}
        </button>

        {error && (
          <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        )}

        {okInfo && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>✅ Angelegt</div>
            <div style={{ opacity: 0.85 }}>tastingId: {okInfo.tastingId}</div>
            <div style={{ opacity: 0.85 }}>publicSlug: {okInfo.publicSlug}</div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`/join?slug=${encodeURIComponent(okInfo.publicSlug)}`} style={{ padding: "10px 12px", border: "1px solid #ddd" }}>
                Join Link testen
              </a>
              <a href={`/admin/print-qr?slug=${encodeURIComponent(okInfo.publicSlug)}`} style={{ padding: "10px 12px", border: "1px solid #ddd" }}>
                QR drucken
              </a>
              <a href={`/admin`} style={{ padding: "10px 12px", border: "1px solid #ddd" }}>
                Zurück zum Dashboard
              </a>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
