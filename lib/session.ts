import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "wf_session";

export type SessionData = {
  tastingId: string;
  participantId: string;
};

function mustSecret(): string {
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
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function sign(payloadB64u: string, secret: string) {
  return base64urlEncode(crypto.createHmac("sha256", secret).update(payloadB64u).digest());
}

function timingSafeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function createSession(data: SessionData) {
  const secret = mustSecret();
  const payload = base64urlEncode(Buffer.from(JSON.stringify(data), "utf8"));
  const sig = sign(payload, secret);
  const value = `${payload}.${sig}`;

  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // kein maxAge => Session-Cookie; wenn du willst, setz z.B. 7 Tage:
    // maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSession() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getSession(): SessionData | null {
  const secret = mustSecret();
  const raw = cookies().get(COOKIE_NAME)?.value ?? "";
  if (!raw) return null;

  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload, secret);
  if (!timingSafeEq(sig, expected)) return null;

  try {
    const json = JSON.parse(base64urlDecode(payload).toString("utf8"));
    if (!json?.tastingId || !json?.participantId) return null;
    return { tastingId: String(json.tastingId), participantId: String(json.participantId) };
  } catch {
    return null;
  }
}

export function requireSession(): SessionData {
  const s = getSession();
  if (!s) throw new Error("Not logged in");
  return s;
}
