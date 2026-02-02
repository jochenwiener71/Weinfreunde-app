import { NextResponse } from "next/server";

function mask(s: string) {
  if (!s) return "";
  const len = s.length;
  if (len <= 12) return "*".repeat(len);
  return `${s.slice(0, 6)}...${s.slice(-6)} (len=${len})`;
}

export async function GET() {
  // WICHTIG: Hier KEIN db(), KEIN firebase-admin init.
  // Wir prüfen nur, was im Runtime-Environment wirklich ankommt.

  const b64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "");
  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "");
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL ?? "");
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY ?? "");
  const bucket = String(process.env.FIREBASE_STORAGE_BUCKET ?? "");

  // häufige Tippfehler / alternative Namen (nur zur Diagnose)
  const alt1 = String((process.env as any).FIREBASE_SERVICEACCOUNT_B64 ?? "");
  const alt2 = String((process.env as any).FIREBASE_SERVICE_ACCOUNT ?? "");
  const alt3 = String((process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON_B64 ?? "");

  return NextResponse.json({
    ok: true,
    runtimeEnvCheck: {
      FIREBASE_SERVICE_ACCOUNT_B64: {
        present: Boolean(b64 && b64.trim()),
        masked: mask(b64.trim()),
      },
      FIREBASE_PROJECT_ID: Boolean(projectId && projectId.trim()),
      FIREBASE_CLIENT_EMAIL: Boolean(clientEmail && clientEmail.trim()),
      FIREBASE_PRIVATE_KEY: Boolean(privateKey && privateKey.trim()),
      FIREBASE_STORAGE_BUCKET: {
        present: Boolean(bucket && bucket.trim()),
        value: bucket.trim() || null,
      },
      possibleTyposOrAlts: {
        FIREBASE_SERVICEACCOUNT_B64: { present: Boolean(alt1 && alt1.trim()), masked: mask(alt1.trim()) },
        FIREBASE_SERVICE_ACCOUNT: { present: Boolean(alt2 && alt2.trim()), masked: mask(alt2.trim()) },
        FIREBASE_SERVICE_ACCOUNT_JSON_B64: { present: Boolean(alt3 && alt3.trim()), masked: mask(alt3.trim()) },
      },
    },
  });
}
