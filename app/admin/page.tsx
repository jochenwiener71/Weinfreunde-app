"use client";

import { useMemo, useState } from "react";

export default function AdminHomePage() {
  const [publicSlug, setPublicSlug] = useState("");
  const [adminSecret, setAdminSecret] = useState("");

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

  const apiAdminRevealHint = useMemo(() => {
    if (!slug) return "";
    return `POST /api/admin/reveal  (Body: { publicSlug: "${slug}", status: "revealed" })`;
  }, [slug]);

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Weinfreunde Tasting App</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Zentrale Admin-Seite mit Links zu Tastings, Weinen und Reporting.
      </p>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Schnellzugriff</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <label style={{ display: "block" }}>
            publicSlug (für Links/Tests)
            <input
              value={publicSlug}
              onChange={(e) => setPublicSlug(e.target.value)}
              placeholder="z. B. weinfreunde"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.2)",
              }}
            />
          </label>

          <label style={{ display: "block" }}>
            ADMIN_SECRET (optional – nur zum Kopieren/Einfügen)
            <input
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="optional (wird nicht gespeichert)"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.2)",
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <a
            href="/admin/create"
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            ➕ Tasting anlegen
          </a>

          <a
            href="/admin/tastings"
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            🗂️ Tastings verwalten
          </a>

          <a
            href="/admin/wines"
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            🍷 Weine verwalten
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
              display: "inline-block",
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

        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Create-Tasting ist fix auf <code>/admin/create</code> gesetzt.
        </p>
      </section>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Debug / API Links (optional)</h2>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Praktisch zum Testen im Browser. Für Admin-Endpunkte brauchst du den Header <code>x-admin-secret</code>.
        </p>

        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Public Summary</div>
            <a
              href={apiSummary || "#"}
              onClick={(e) => !apiSummary && e.preventDefault()}
              style={{ wordBreak: "break-all" }}
            >
              {apiSummary || "— (publicSlug fehlt)"}
            </a>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Public Wines</div>
            <a
              href={apiWines || "#"}
              onClick={(e) => !apiWines && e.preventDefault()}
              style={{ wordBreak: "break-all" }}
            >
              {apiWines || "— (publicSlug fehlt)"}
            </a>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Admin Get-Tasting (Header nötig)</div>
            <div style={{ wordBreak: "break-all" }}>{apiAdminGetTasting || "— (publicSlug fehlt)"}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Admin Reveal (Header nötig)</div>
            <div style={{ wordBreak: "break-all" }}>{apiAdminRevealHint || "— (publicSlug fehlt)"}</div>
          </div>
        </div>

        {adminSecret.trim() && (
          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Secret ist im Feld eingetragen. Für Admin-Endpunkte im Browser braucht man es als Header – später können wir mehr
            Aktionen direkt als Buttons integrieren.
          </p>
        )}
      </section>
    </main>
  );
}
