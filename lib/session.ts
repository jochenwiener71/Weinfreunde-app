// lib/session.ts
import { cookies } from "next/headers";
import crypto from "crypto";

export type SessionData = {
  tastingId: string;
  participantId: string;
  name: string;
};

const COOKIE_NAME = "wf_session";

// ---------- helpers ----------
function getSecret() {
  const s = String(process.env.SESSION_SECRET ?? "").trim();
  if (!s) throw new Error("Server misconfigured: SESSION_SECRET is not set.");
  return s;
}

function base64urlEncode(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(s: string) {
  const pad = 4 - (s.length % 4 || 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

function sign(payloadJson: string) {
  const secret = getSecret();
  const sig = crypto.createHmac("sha256", secret).update(payloadJson).digest();
  return base64urlEncode(sig);
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function makeToken(data: SessionData) {
  const payload = { ...data, iat: Date.now() };
  const payloadJson = JSON.stringify(payload);
  return `${base64urlEncode(Buffer.from(payloadJson, "utf8"))}.${sign(payloadJson)}`;
}

function setCookieOn(target: any, token: string) {
  // If we have a NextResponse-like object with res.cookies.set(...)
  if (target && typeof target === "object" && target.cookies && typeof target.cookies.set === "function") {
    target.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return;
  }

  // Fallback: set cookie via next/headers cookies()
  cookies().set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// ---------- API ----------
export async function createSession(data: SessionData) {
  const token = makeToken(data);
  setCookieOn(null, token);
}

/**
 * ✅ Compatibility export: setSessionCookie
 *
 * Unterstützt ALLE Varianten, die bei dir im Projekt vorkommen:
 * 1) setSessionCookie({ tastingId, participantId, name })
 * 2) setSessionCookie(tastingId, participantId, name)
 * 3) setSessionCookie(res, { tastingId, participantId, participantName | name })
 */
export async function setSessionCookie(data: SessionData): Promise<void>;
export async function setSessionCookie(tastingId: string, participantId: string, name: string): Promise<void>;
export async function setSessionCookie(
  res: any,
  data: { tastingId: string; participantId: string; participantName?: string; name?: string }
): Promise<void>;
export async function setSessionCookie(a: any, b?: any, c?: any) {
  // 3 args: (tastingId, participantId, name)
  if (typeof a === "string") {
    const tastingId = String(a).trim();
    const participantId = String(b ?? "").trim();
    const name = String(c ?? "").trim();
    const token = makeToken({ tastingId, participantId, name });
    setCookieOn(null, token);
    return;
  }

  // 2 args: (res, payload)
  if (a && b && typeof b === "object") {
    const tastingId = String(b.tastingId ?? "").trim();
    const participantId = String(b.participantId ?? "").trim();
    const name = String(b.participantName ?? b.name ?? "").trim();
    const token = makeToken({ tastingId, participantId, name });
    setCookieOn(a, token);
    return;
  }

  // 1 arg: ({ tastingId, participantId, name })
  if (a && typeof a === "object") {
    const tastingId = String(a.tastingId ?? "").trim();
    const participantId = String(a.participantId ?? "").trim();
    const name = String(a.name ?? "").trim();
    const token = makeToken({ tastingId, participantId, name });
    setCookieOn(null, token);
    return;
  }

  throw new Error("Invalid setSessionCookie call");
}

export function clearSession() {
  cookies().set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getSession(): SessionData | null {
  const c = cookies().get(COOKIE_NAME)?.value;
  if (!c) return null;

  const [payloadB64, sig] = c.split(".");
  if (!payloadB64 || !sig) return null;

  const payloadJson = base64urlDecode(payloadB64).toString("utf8");
  const expected = sign(payloadJson);

  // Timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  const parsed = safeJsonParse<any>(payloadJson);
  if (!parsed) return null;

  const tastingId = String(parsed.tastingId ?? "").trim();
  const participantId = String(parsed.participantId ?? "").trim();
  const name = String(parsed.name ?? "").trim();

  if (!tastingId || !participantId || !name) return null;

  return { tastingId, participantId, name };
}

export function requireSession(): SessionData {
  const s = getSession();
  if (!s) throw new Error("Not logged in");
  return s;
}
