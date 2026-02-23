// lib/session.ts
import { cookies } from "next/headers";
import crypto from "crypto";
import type { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "wf_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage (kannst du lassen)
// Wenn du willst: 12h => 60*60*12 oder 24h => 60*60*24

export type SessionData = {
  tastingId: string;
  participantId: string;
  participantName: string;
  publicSlug?: string;
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

  // timing safe compare (gleiche byte length!)
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const data = JSON.parse(json);

    if (!data?.tastingId || !data?.participantId || !data?.participantName) return null;

    return data as SessionData;
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production", // ✅ wichtig (prod https, dev http)
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/** ✅ Set cookie on a NextResponse (z.B. in /api/join) */
export function setSessionCookie(res: NextResponse, data: SessionData) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: encode(data),
    ...cookieOptions(),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    ...cookieOptions(),
    maxAge: 0,
  });
}

/** ✅ Read session (Route Handlers & Server Components) */
export function getSession(): SessionData | null {
  const c = cookies().get(COOKIE_NAME)?.value;
  if (!c) return null;
  return decode(c);
}

/**
 * ✅ Sliding refresh:
 * Wenn Session gültig ist, setzen wir das Cookie neu (verlängert Laufzeit).
 * Funktioniert in Route Handlers. In Server Components kann cookies().set fehlschlagen,
 * deshalb try/catch.
 */
export function touchSessionCookie(data: SessionData) {
  try {
    cookies().set({
      name: COOKIE_NAME,
      value: encode(data),
      ...cookieOptions(),
    });
  } catch {
    // In Server Components ggf. read-only – dann einfach nichts tun.
  }
}

export function requireSession(): SessionData {
  const s = getSession();
  if (!s) throw new Error("Not logged in");
  // ✅ verlängert Session bei jedem API-Call (sliding)
  touchSessionCookie(s);
  return s;
}

/** Optional praktisch: Join darf “bereits eingeloggt” akzeptieren */
export function requireSessionOptional(): SessionData | null {
  const s = getSession();
  if (s) touchSessionCookie(s);
  return s;
}
