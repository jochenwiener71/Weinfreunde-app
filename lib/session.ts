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

// ---------- API ----------
export async function createSession(data: SessionData) {
  const payload = {
    ...data,
    iat: Date.now(),
  };

  const payloadJson = JSON.stringify(payload);
  const token = `${base64urlEncode(Buffer.from(payloadJson, "utf8"))}.${sign(payloadJson)}`;

  cookies().set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    // optional: 30 Tage
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * ✅ Compatibility export:
 * Manche Routes importieren "setSessionCookie".
 * Unterstützt beide Varianten:
 *  - setSessionCookie({ tastingId, participantId, name })
 *  - setSessionCookie(tastingId, participantId, name)
 */
export async function setSessionCookie(data: SessionData): Promise<void>;
export async function setSessionCookie(
  tastingId: string,
  participantId: string,
  name: string
): Promise<void>;
export async function setSessionCookie(
  a: SessionData | string,
  b?: string,
  c?: string
) {
  if (typeof a === "string") {
    const tastingId = a;
    const participantId = String(b ?? "").trim();
    const name = String(c ?? "").trim();
    await createSession({ tastingId, participantId, name });
    return;
  }
  await createSession(a);
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
