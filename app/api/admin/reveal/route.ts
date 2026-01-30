import { NextResponse } from "next/server";

export const runtime = "nodejs"; // wichtig: garantiert Node-Runtime (nicht Edge)

function isSet(name: string) {
  const v = process.env[name];
  return Boolean(v && String(v).trim().length > 0);
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

  const result: Record<string, boolean> = {};
  for (const k of keys) result[k] = isSet(k);

  return NextResponse.json({
    ok: true,
    env: result,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
