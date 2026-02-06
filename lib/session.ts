import { cookies } from "next/headers";
import crypto from "crypto";

export type SessionData = {
  tastingId: string;
  participantId: string;
};

const COOKIE_NAME = "wf_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

function base64urlEncode(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(str: string) {
  const pad = str.length % 4;
  const s = (pad ? str + "=".repeat(4 - pad) : str).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(s, "base64");
}

function getSecret(): string {
  const s = String(process.env.SESSION_SECRET ?? "").trim();
  if (!s) throw new Error("Server misconfigured: SESSION_SECRET is not set.");
  return s;
}

function sign(payloadB64: string): string {
  const h = crypto.createHmac("sha256", getSecret());
  h.update(payloadB64);
  return base64urlEncode(h.digest());
}

function encodeSession(data: SessionData): string {
  const payload = base64urlEncode(Buffer.from(JSON.stringify(data), "utf8"));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function decodeSession(token: string): SessionData | null {
  const [payloadB64, sig] = String(token || "").split(".");
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const json = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
    const tastingId = String(json?.tastingId ?? "").trim();
    const participantId = String(json?.participantId ?? "").trim();
    if (!tastingId || !participantId) return null;
    return { tastingId, participantId };
  } catch {
    return null;
  }
}

export async function createSession(data: SessionData) {
  const token = encodeSession(data);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSession() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export function getSession(): SessionData | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export function requireSession(): SessionData {
  const s = getSession();
  if (!s) throw new Error("Not logged in");
  return s;
}
