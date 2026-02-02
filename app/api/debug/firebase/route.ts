import { NextResponse } from "next/server";

function mask(s: string) {
  if (!s) return "";
  const len = s.length;
  if (len <= 12) return "*".repeat(len);
  return `${s.slice(0, 6)}...${s.slice(-6)} (len=${len})`;
}

export async function GET() {
  const b64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "").trim();
  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL ?? "").trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY ?? "").trim();
  const bucket = String(process.env.FIREBASE_STORAGE_BUCKET ?? "").trim();

  const alt1 = String((process.env as any).FIREBASE_SERVICEACCOUNT_B64 ?? "").trim();
  const alt2 = String((process.env as any).FIREBASE_SERVICE_ACCOUNT ?? "").trim();
  const alt3 = String((process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON_B64 ?? "").trim();

  return NextResponse.json({
    ok: true,
    route: "/api/_debug/firebase",
    runtimeEnvCheck: {
      FIREBASE_SERVICE_ACCOUNT_B64: { present: Boolean(b64), masked: mask(b64) },
      FIREBASE_PROJECT_ID: { present: Boolean(projectId), value: projectId || null },
      FIREBASE_CLIENT_EMAIL: { present: Boolean(clientEmail), value: clientEmail || null },
      FIREBASE_PRIVATE_KEY: { present: Boolean(privateKey), masked: mask(privateKey) },
      FIREBASE_STORAGE_BUCKET: { present: Boolean(bucket), value: bucket || null },
      possibleTyposOrAlts: {
        FIREBASE_SERVICEACCOUNT_B64: { present: Boolean(alt1), masked: mask(alt1) },
        FIREBASE_SERVICE_ACCOUNT: { present: Boolean(alt2), masked: mask(alt2) },
        FIREBASE_SERVICE_ACCOUNT_JSON_B64: { present: Boolean(alt3), masked: mask(alt3) },
      },
    },
  });
}
