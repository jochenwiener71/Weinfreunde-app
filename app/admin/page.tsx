"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function encode(s: string) {
  return encodeURIComponent(s);
}

function btnStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 8,
    textDecoration: "none",
    color: "inherit",
    background: disabled ? "rgba(0,0,0,0.04)" : "white",
    opacity: disabled ? 0.55 : 1,
    pointerEvents: disabled ? "none" : "auto",
    display: "inline-block",
  };
}

export default function AdminPage() {
  const [publicSlug, setPublicSlug] = useState("");

  const slug = useMemo(() => publicSlug.trim(), [publicSlug]);

  // ===== JOIN / QR =====

  const joinUrl = useMemo(() => {
    if (!slug) return "";
    return `/join?slug=${encode(slug)}`;
  }, [slug]);

  const qrUrl = useMemo(() => {
    if (!joinUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encode(
      joinUrl
    )}`;
  }, [joinUrl]);

  // ===== ADMIN ROUTES =====
  // (nur existierende!)

  const tastingAdmin = slug ? `/admin/tasting/${encode(slug)}` : "";
  const participantsAdmin = slug
    ? `/admin/participants/${encode(slug)}`
    : "";
  const criteriaAdmin = slug ? `/admin/criteria/${encode(slug)}` : "";
  const publicReporting = slug ? `/reporting/${encode(slug)}` : "";

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
    window.open(`/admin/print-qr?slug=${encode(slug)}`, "_blank");
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, fontFamily: "system-ui" }}>
      <h1>Admin Dashboard</h1>

      {/* ===== GLOBAL LINKS ===== */}

      <section style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/admin/tastings" style={btnStyle(false)}>
          Tastings verwalten
        </Link>

        <Link href="/admin/create" style={btnStyle(false)}>
          Neues Tasting erstellen
        </Link>

        <Link href="/admin/wines" style={btnStyle(false)}>
          Weine verwalten
        </Link>

        <Link href="/admin/reporting" style={btnStyle(false)}>
          Reporting Übersicht
        </Link>
      </section>

      {/* ===== SLUG CONTEXT ===== */}

      <section
        style={{
          marginTop: 24,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 18,
        }}
      >
        <h3>Tasting Kontext (publicSlug)</h3>

        <input
          value={publicSlug}
          onChange={(e) => setPublicSlug(e.target.value)}
          placeholder="weinfreunde-feb26"
          style={{
            width: "100%",
            padding: 10,
            marginTop: 6,
          }}
        />

        {/* ===== CONTEXT LINKS ===== */}

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={tastingAdmin || "#"} style={btnStyle(!slug)}>
            Tasting verwalten
          </Link>

          <Link href={participantsAdmin || "#"} style={btnStyle(!slug)}>
            Teilnehmer verwalten
          </Link>

          <Link href={criteriaAdmin || "#"} style={btnStyle(!slug)}>
            Kategorien verwalten
          </Link>

          <Link href={publicReporting || "#"} style={btnStyle(!slug)}>
            Public Reporting öffnen
          </Link>

          <Link href={joinUrl || "#"} style={btnStyle(!slug)}>
            Join Seite öffnen
          </Link>

          <button
            onClick={() => joinUrl && copy(joinUrl)}
            disabled={!slug}
            style={{ ...btnStyle(!slug), cursor: "pointer" }}
          >
            Join Link kopieren
          </button>

          <button
            onClick={openPrint}
            disabled={!slug}
            style={{ ...btnStyle(!slug), cursor: "pointer" }}
          >
            QR Druckansicht
          </button>
        </div>

        {/* ===== QR ===== */}

        {slug && (
          <div style={{ marginTop: 18 }}>
            <img
              src={qrUrl}
              alt="QR"
              width={150}
              height={150}
              style={{ border: "1px solid #ddd", borderRadius: 8 }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
