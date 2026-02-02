import { NextResponse } from "next/server";

function mask(s: string) {
  if (!s) return "";
  const len = s.length;
  if (len <= 12) return "*".repeat(len);
  return `${s.slice(0, 6)}...${s.slice(-6)} (len=${len})`;
}

function inspectEnv(key: string) {
  const hasKey = Object.prototype.hasOwnProperty.call(process.env, key);
  const raw = (process.env as any)[key];
  const isDefined = typeof raw !== "undefined";
  const value = String(raw ?? "");
  const trimmed = value.trim();

  return {
    hasKey, // existiert key in process.env?
    isDefined, // nicht undefined?
    len: value.length, // inkl whitespace
    trimmedLen: trimmed.length,
    masked: trimmed ? mask(trimmed) : "",
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/debug/firebase",
    runtimeEnvCheck: {
      FIREBASE_SERVICE_ACCOUNT_B64: inspectEnv("FIREBASE_SERVICE_ACCOUNT_B64"),
      FIREBASE_PROJECT_ID: inspectEnv("FIREBASE_PROJECT_ID"),
      FIREBASE_CLIENT_EMAIL: inspectEnv("FIREBASE_CLIENT_EMAIL"),
      FIREBASE_PRIVATE_KEY: inspectEnv("FIREBASE_PRIVATE_KEY"),
      FIREBASE_STORAGE_BUCKET: inspectEnv("FIREBASE_STORAGE_BUCKET"),
      possibleTyposOrAlts: {
        FIREBASE_SERVICEACCOUNT_B64: inspectEnv("FIREBASE_SERVICEACCOUNT_B64"),
        FIREBASE_SERVICE_ACCOUNT: inspectEnv("FIREBASE_SERVICE_ACCOUNT"),
        FIREBASE_SERVICE_ACCOUNT_JSON_B64: inspectEnv("FIREBASE_SERVICE_ACCOUNT_JSON_B64"),
      },
    },
  });
}
