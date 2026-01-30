import { NextResponse } from "next/server";

export const runtime = "nodejs"; // wichtig: garantiert Node-Runtime

function isSet(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && String(v).trim().length > 0);
}

function len(name: string): number {
  const v = process.env[name];
  return v ? String(v).length : 0;
}

export async function GET() {
  const keys = [
    "ADMIN_SECRET",
    "PIN_SALT",
    "FIREBASE_SERVICE_ACCOUNT_B64",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ];

  const rows = keys
    .map((k) => {
      const ok = isSet(k);
      const l = len(k);
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;font-family:system-ui">${k}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;font-family:system-ui">
            ${ok ? "✅ true" : "❌ false"}
          </td>
          <td style="padding:8px;border-bottom:1px solid #ddd;font-family:system-ui">
            ${l}
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Env Reveal</title>
</head>
<body style="margin:0;padding:24px;font-family:system-ui;background:#fff;color:#111">
  <h1 style="margin:0 0 12px 0">Env Reveal (safe)</h1>
  <p style="margin:0 0 16px 0;color:#555">
    Zeigt nur <strong>true/false</strong> und die <strong>Länge</strong> der Env-Variablen.
    Keine Secrets werden ausgegeben.
  </p>

  <table style="border-collapse:collapse;width:100%;max-width:720px">
    <thead>
      <tr>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #000">Variable</th>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #000">Gesetzt?</th>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #000">Länge</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <hr style="margin:24px 0" />

  <p style="color:#555;font-size:14px">
    NODE_ENV: <strong>${process.env.NODE_ENV ?? "n/a"}</strong><br/>
    VERCEL_ENV: <strong>${process.env.VERCEL_ENV ?? "n/a"}</strong>
  </p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
