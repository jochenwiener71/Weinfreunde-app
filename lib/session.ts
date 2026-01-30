import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "wf_session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-session-secret-change-me";

type SessionData = {
  tastingId: string;
  participantId: string;
};

function sign(value: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export async function createSession(data: SessionData) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(payload);

  cookies().set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
}

export async function requireSession(): Promise<SessionData | null> {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
