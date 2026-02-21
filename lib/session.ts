// lib/session.ts
import { cookies } from "next/headers";
import crypto from "crypto";
import type { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "wf_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage

// ✅ Session-Shape (hier kommt dein publicSlug rein)
export type SessionData = {
  tastingId: string;
  participantId: string;
  participantName: string;
  publicSlug?: string; // ✅ NEU
};

function requireSessionSecret() {
  const secret = (process.env.SESSION_SECRET ?? "").trim();
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is not set or too short (min 32 chars).");
  }
  return secret;
}

function sign(payloadB64: string) {
  const secret = requireSessionSecret();
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function encode(data: SessionData) {
  const json = JSON.stringify(data);
  const payloadB64 = Buffer.from(json, "utf8").toString("base64url");
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

function decode(value: string): SessionData | null {
  const [payloadB64, sig] = String(value ?? "").split(".");
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);

  // timing safe compare => gleiche byte length!
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const data = JSON.parse(json);

    if (!data?.tastingId || !data?.participantId || !data?.participantName) return null;

    // ✅ publicSlug ist optional, daher kein Muss
    return data as SessionData;
  } catch {
    return null;
  }
}

// ✅ Set cookie on a NextResponse
export function setSessionCookie(res: NextResponse, data: SessionData) {
  const value = encode(data);

  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

// ✅ Read session in Server Components / Route Handlers
export function getSession(): SessionData | null {
  const c = cookies().get(COOKIE_NAME)?.value;
  if (!c) return null;
  return decode(c);
}

export function requireSession(): SessionData {
  const s = getSession();
  if (!s) throw new Error("Not logged in");
  return s;
}
