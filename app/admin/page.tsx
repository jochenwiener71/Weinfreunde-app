"use client";

import { useMemo, useState } from "react";

function encode(s: string) {
  return encodeURIComponent(s);
}

export default function AdminPage() {
  const [publicSlug, setPublicSlug] = useState("");

  const joinUrl = useMemo(() => {
    const slug = publicSlug.trim();
    if (!slug) return "";
    return `https://weinfreunde-app.vercel.app/join?slug=${encode(slug)}`;
  }, [publicSlug]);

  const qrUrl = useMemo(() => {
    if (!joinUrl) return "";
    // QR als Bild ohne Library
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encode(joinUrl)}`;
  }, [joinUrl]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Link kopiert ✅");
    } catch {
      // iOS/Safari fallback
      prompt("Kopiere den Link:", text);
    }
  }

  function openPrint() {
    if (!joinUrl) return;
    const slug = publicSlug.trim();
    const printUrl = `/admin/print-qr?slug=${encode(slug)}`;
    window.open(printUrl, "_blank");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 960 }}>
      <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>

      <p style={{ marginTop: 6, opacity: 0.75 }}>
        QR-Code generieren für die Teilnehmer-Registrierung (/join).
      </p>

      <section
        style={{
          marginTop: 18,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>QR-Code für Teilnehmer-Registrierung</h2>

        <label style={{ display: "block" }}>
          publicSlug
          <input
            value={publicSlug}
            onChange={(e) => setPublicSlug(e.target.value)}
            placeholder="weinfreunde"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        {!joinUrl ? (
          <p style={{ margin: "10px 0 0 0", fontSize: 13, opacity: 0.7 }}>
            Slug eingeben → QR erscheint automatisch.
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

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => copy(joinUrl)} style={{ padding: "10px 12px" }}>
                  Link kopieren
                </button>

                <a
                  href={joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "10px 12px",
                    border: "1px solid rgba(0,0,0,0.18)",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "inherit",
                    textAlign: "center",
                  }}
                >
                  Join öffnen
                </a>

                <button onClick={openPrint} style={{ padding: "10px 12px" }}>
                  Druckansicht
                </button>
              </div>
            </div>

            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, opacity: 0.7 }}>
              Tipp: Für Ausdruck nutze „Druckansicht“ (größerer QR + Text).
            </p>
          </>
        )}
      </section>

      <hr style={{ marginTop: 18, opacity: 0.2 }} />

      <section style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href="/admin/create"
          style={{
            padding: "10px 12px",
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Tasting anlegen
        </a>

        <a
          href="/admin/wines"
          style={{
            padding: "10px 12px",
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Weine verwalten
        </a>

        <a
          href="/admin/reporting"
          style={{
            padding: "10px 12px",
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Reporting
        </a>
      </section>
    </main>
  );
}
