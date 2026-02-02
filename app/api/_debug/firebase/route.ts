import { NextResponse } from "next/server";

export async function GET() {
  const b64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "").trim();

  return NextResponse.json({
    hasB64: !!b64,
    b64Len: b64.length,
    b64StartsWith: b64.slice(0, 16),
    nodeEnv: process.env.NODE_ENV,
  });
}
