"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

function encode(s: string) {
  return encodeURIComponent(s);
}

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
  };
}

const SS_SLUG = "wf_admin_publicSlug";
const SS_SECRET = "wf_admin_secret";

export default function AdminPage() {
  const [publicSlug, setPublicSlug] = useState("");
  const [adminSecret, setAdminSecret] = useState("");

  // ✅ Restore from sessionStorage (so Back-to-Dashboard keeps values)
  useEffect(() => {
    try {
      const savedSlug = sessionStorage.getItem(SS_SLUG) ?? "";
      const savedSecret = sessionStorage.getItem(SS_SECRET) ?? "";
      if (savedSlug) setPublicSlug(savedSlug);
      if (savedSecret) setAdminSecret(savedSecret);
    } catch {
      // ignore
    }
  }, []);

  // ✅ Persist to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_SLUG, publicSlug.trim());
    } catch {
      // ignore
    }
  }, [publicSlug]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_SECRET, adminSecret);
    } catch {
      // ignore
    }
  }, [adminSecret]);

  const slug = useMemo(() => publicSlug.trim(), [publicSlug]);

  const joinUrl = useMemo(() => {
    if (!slug) return "";
    return `https://weinfreunde-app.vercel.app/join?slug=${encode(slug)}`;
  }, [slug]);

  const qrUrl = useMemo(() => {
    if (!joinUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encode(joinUrl)}`;
  }, [joinUrl]);

  // ✅ Correct deep links to routes that exist in your repo
  const manageTastingHref = useMemo(() => {
    if (!slug) return "";
    return `/admin/tasting/${encode(slug)}`; // exists: app/admin/tasting/[slug]/page.tsx
  }, [slug]);

  const manageParticipantsHref = useMemo(() => {
    if (!slug) return "";
    return `/admin/participants/${encode(slug)}`; // exists
  }, [slug]);

  const manageCriteriaHref = useMemo(() => {
    if (!slug) return "";
    return `/admin/criteria/${encode(slug)}`; // exists
  }, [slug]);

  const manageWinesHref = useMemo(() => {
    // your /admin/wines is global and already works
    return `/admin/wines`;
  }, []);

  // ✅ reporting public is /reporting/[slug] (NOT /reporting)
  const publicReportingHref = useMemo(() => {
    if (!slug) return "";
    return `/reporting/${encode(slug)}`;
  }, [slug]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Link kopiert ✅");
    } catch {
      prompt("Kopiere den Link:", text);
    }
  }

  function openPrint() {
    if (!slug) return;
    const printUrl = `/admin/print-qr?slug=${encode(slug)}`;
    window.open(printUrl, "_blank");
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SS_SLUG);
      sessionStorage.removeItem(SS_SECRET);
    } catch {}
    setPublicSlug("");
    setAdminSecret("");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 960 }}>
      <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>

      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Schnellzugriff: Tastings verwalten, QR-Code erzeugen, Weine/Teilnehmer/Kriterien pflegen.
      </p>

      {/* ✅ GLOBAL QUICK LINKS */}
      <section style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/admin/tastings" style={btnStyle(false)}>
          Tastings verwalten
        </Link>

        <Link href="/admin/create" style={btnStyle(false)}>
          Tasting anlegen
        </Link>

        <Link href="/admin/wines" style={btnStyle(false)}>
          Weine verwalten
        </Link>

        <Link href="/admin/reporting" style={btnStyle(false)}>
          Admin Reporting
        </Link>
      </section>

      {/* ✅ CONTEXT BOX */}
      <section
        style={{
          marginTop: 18,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Tasting-Kontext</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "block" }}>
            publicSlug
            <input
              value={publicSlug}
              onChange={(e) => setPublicSlug(e.target.value)}
              placeholder="weinfreunde-feb26"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>

          <label style={{ display: "block" }}>
            ADMIN_SECRET
            <input
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="mysecret"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={manageTastingHref || "#"} style={btnStyle(!slug)}>
            Tasting verwalten (dieser Slug)
          </Link>

          <Link href={manageWinesHref} style={btnStyle(false)}>
            Weine verwalten
          </Link>

          <Link href={manageParticipantsHref || "#"} style={btnStyle(!slug)}>
            Teilnehmer verwalten
          </Link>

          <Link href={manageCriteriaHref || "#"} style={btnStyle(!slug)}>
            Kategorien/Kriterien verwalten
          </Link>

          <Link href={publicReportingHref || "#"} style={btnStyle(!slug)}>
            Public Reporting öffnen
          </Link>

          <a href={joinUrl || "#"} target="_blank" rel="noreferrer" style={btnStyle(!slug)}>
            Join öffnen
          </a>

          <button
            onClick={() => joinUrl && copy(joinUrl)}
            disabled={!slug}
            style={{ ...btnStyle(!slug), cursor: !slug ? "not-allowed" : "pointer" }}
          >
            Join-Link kopieren
          </button>

          <button
            onClick={openPrint}
            disabled={!slug}
            style={{ ...btnStyle(!slug), cursor: !slug ? "not-allowed" : "pointer" }}
          >
            QR Druckansicht
          </button>

          <button
            onClick={clearSession}
            style={{ ...btnStyle(false), cursor: "pointer" }}
            title="Slug+Secret aus dem Tab löschen"
          >
            Session leeren
          </button>
        </div>

        {!joinUrl ? (
          <p style={{ margin: "12px 0 0 0", fontSize: 13, opacity: 0.7 }}>
            publicSlug eingeben → Join-Link / QR / Admin-Links werden aktiv.
          </p>
        ) : (
          <>
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
              Join-Link:
              <div style={{ marginTop: 6, wordBreak: "break-all" }}>
                <code>{joinUrl}</code>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <img
                src={qrUrl}
                alt="QR Code"
                width={160}
                height={160}
                style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8 }}
              />

              <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 480 }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>Hinweis:</strong> Public Reporting ist <code>/reporting/[slug]</code> – daher war{" "}
                  <code>/reporting</code> bei dir 404.
                </div>
                <div>
                  Secret+Slug werden im Tab gespeichert (sessionStorage) → „← Admin Dashboard“ fragt nicht neu.
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
