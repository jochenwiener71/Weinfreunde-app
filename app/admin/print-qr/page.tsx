"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

function encode(s: string) {
  return encodeURIComponent(s);
}

export default function PrintQrPage() {
  const sp = useSearchParams();
  const slug = String(sp.get("slug") ?? "").trim();

  const joinUrl = useMemo(() => {
    if (!slug) return "";
    return `https://weinfreunde-app.vercel.app/join?slug=${encode(slug)}`;
  }, [slug]);

  const qrUrl = useMemo(() => {
    if (!joinUrl) return "";
    // Für Druck deutlich größer:
    return `https://api.qrserver.com/v1/create-qr-code/?size=700x700&data=${encode(joinUrl)}`;
  }, [joinUrl]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Weinfreunde · Join</h1>

        {!slug ? (
          <p>Fehler: Missing slug</p>
        ) : (
          <>
            <p style={{ fontSize: 16, marginBottom: 10 }}>
              Scanne den QR-Code und registriere dich mit Vorname + PIN.
            </p>

            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <img src={qrUrl} alt="QR Code" width={360} height={360} />

              <div style={{ minWidth: 280 }}>
                <div style={{ fontSize: 14, opacity: 0.8 }}>Link:</div>
                <div style={{ marginTop: 6, wordBreak: "break-all" }}>
                  <code>{joinUrl}</code>
                </div>

                <div style={{ marginTop: 18 }}>
                  <button
                    onClick={() => window.print()}
                    style={{ padding: "12px 14px", fontSize: 16 }}
                  >
                    Drucken
                  </button>
                </div>

                <p style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
                  Tipp: Im Druckdialog „Hintergrundgrafiken“ aktivieren (falls nötig).
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
