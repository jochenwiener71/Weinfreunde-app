"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

function encode(s: string) {
  return encodeURIComponent(s);
}

function btnStyle(disabled?: boolean): CSSProperties {
  return {
    padding: "10px 12px",
    border: "1px solid rgba(0,0,0,0.18)",
    borderRadius: 8,
    textDecoration: "none",
    color: "inherit",
    background: disabled ? "rgba(0,0,0,0.04)" : "transparent",
    opacity: disabled ? 0.55 : 1,
    pointerEvents: disabled ? "none" : "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

export default function AdminPage() {
  const [publicSlug, setPublicSlug] = useState("");

  const slug = useMemo(() => publicSlug.trim(), [publicSlug]);

  const joinUrl = useMemo(() => {
    if (!slug) return "";
    return `https://weinfreunde-app.vercel.app/join?slug=${encode(slug)}`;
  }, [slug]);

  const qrUrl = useMemo(() => {
    if (!joinUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encode(
      joinUrl
    )}`;
  }, [joinUrl]);

  // ✅ Existing routes in your repo
  const manageParticipantsHref = useMemo(() => {
    if (!slug) return "";
    return `/admin/participants/${encode(slug)}`;
  }, [slug]);

  const manageCriteriaHref = useMemo(() => {
    if (!slug) return "";
    return `/admin/criteria/${encode(slug)}`;
  }, [slug]);

  const manageTastingHref = useMemo(() => {
    if (!slug) return "";
    return `/admin/tasting/${encode(slug)}`;
  }, [slug]);

  const publicReportingHref = useMemo(() => {
    if (!slug) return "";
    // ✅ public reporting is /reporting/[slug] (NOT /reporting)
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

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 960 }}>
      <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>

      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Schnellzugriff: Tastings, Teilnehmer, Kriterien, QR/Join, Reporting.
      </p>

      {/* ✅ GLOBAL QUICK LINKS */}
      <section
        style={{
          marginTop: 16,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Link href="/admin/tastings" style={btnStyle(false)}>
          🗂️ Tastings
        </Link>

        <Link href="/admin/create" style={btnStyle(false)}>
          ➕ Tasting anlegen
        </Link>

        <Link href="/admin/wines" style={btnStyle(false)}>
          🍷 Weine
        </Link>

        <Link href="/admin/reporting" style={btnStyle(false)}>
          📊 Reporting (Admin)
        </Link>
      </section>

      {/* ✅ CONTEXT QUICK ACTIONS (for a specific slug) */}
      <section
        style={{
          marginTop: 18,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>
          Tasting-Kontext (publicSlug)
        </h2>

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

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link href={manageTastingHref || "#"} style={btnStyle(!slug)}>
            ⚙️ Tasting verwalten
          </Link>

          <Link href={manageParticipantsHref || "#"} style={btnStyle(!slug)}>
            👥 Teilnehmer verwalten
          </Link>

          <Link href={manageCriteriaHref || "#"} style={btnStyle(!slug)}>
            ✅ Kategorien/Kriterien
          </Link>

          <a
            href={joinUrl || "#"}
            target="_blank"
            rel="noreferrer"
            style={btnStyle(!slug)}
          >
            🔗 Join öffnen
          </a>

          <a
            href={publicReportingHref || "#"}
            target="_blank"
            rel="noreferrer"
            style={btnStyle(!slug)}
          >
            📊 Public Reporting öffnen
          </a>

          <button
            onClick={() => joinUrl && copy(joinUrl)}
            disabled={!slug}
            style={{
              ...btnStyle(!slug),
              cursor: !slug ? "not-allowed" : "pointer",
            }}
          >
            📋 Join-Link kopieren
          </button>

          <button
            onClick={openPrint}
            disabled={!slug}
            style={{
              ...btnStyle(!slug),
              cursor: !slug ? "not-allowed" : "pointer",
            }}
          >
            🖨️ QR Druckansicht
          </button>
        </div>

        {/* ✅ QR BOX */}
        {!joinUrl ? (
          <p style={{ margin: "12px 0 0 0", fontSize: 13, opacity: 0.7 }}>
            Slug eingeben → Join-Link / QR / Admin-Links werden aktiv.
          </p>
        ) : (
          <>
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
              Join-Link:
              <div style={{ marginTop: 6, wordBreak: "break-all" }}>
                <code>{joinUrl}</code>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <img
                src={qrUrl}
                alt="QR Code"
                width={160}
                height={160}
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 8,
                }}
              />

              <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 520 }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>Routing-Check:</strong>
                  <div>
                    Admin Participants: <code>/admin/participants/[slug]</code>
                  </div>
                  <div>
                    Admin Criteria: <code>/admin/criteria/[slug]</code>
                  </div>
                  <div>
                    Admin Tasting: <code>/admin/tasting/[slug]</code>
                  </div>
                  <div>
                    Public Reporting: <code>/reporting/[slug]</code> (nicht{" "}
                    <code>/reporting</code>)
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
