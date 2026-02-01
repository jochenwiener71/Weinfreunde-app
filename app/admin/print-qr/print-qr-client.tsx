"use client";

import { useSearchParams } from "next/navigation";

export default function PrintQrClient() {
  const searchParams = useSearchParams();
  const slug = String(searchParams.get("slug") ?? "").trim();

  if (!slug) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>QR-Code drucken</h1>
        <p style={{ color: "crimson" }}>Fehlender publicSlug</p>
      </main>
    );
  }

  const joinUrl = `https://weinfreunde-app.vercel.app/join?slug=${encodeURIComponent(slug)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(joinUrl)}`;

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "system-ui",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginBottom: 12 }}>Weinfreunde Tasting</h1>

      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Teilnehmer scannen den QR-Code oder öffnen:
      </p>

      <p style={{ fontSize: 18, marginBottom: 20 }}>
        <strong>{joinUrl}</strong>
      </p>

      <img
        src={qrUrl}
        alt="QR Code"
        width={360}
        height={360}
        style={{ border: "2px solid #000", padding: 12 }}
      />

      <div style={{ marginTop: 30 }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "12px 20px",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Drucken
        </button>
      </div>
    </main>
  );
}
