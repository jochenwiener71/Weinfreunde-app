// lib/session.ts
import { cookies } from "next/headers";

const SESSION_COOKIE = "wf_session";

export type SessionData = {
  tastingId: string;
  participantId: string;
};

/**
 * Session anlegen (Join)
 */
export async function createSession(data: SessionData) {
  const value = Buffer.from(JSON.stringify(data)).toString("base64");

  cookies().set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 Stunden
  });
}

/**
 * Session lesen (optional)
 */
export async function getSession(): Promise<SessionData | null> {
  const c = cookies().get(SESSION_COOKIE);
  if (!c?.value) return null;

  try {
    const json = Buffer.from(c.value, "base64").toString("utf8");
    return JSON.parse(json) as SessionData;
  } catch {
    return null;
  }
}

/**
 * ✅ Session erzwingen (für rating/save, rating/get, etc.)
 */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not logged in");
  }
  return session;
}

/**
 * Optional: Logout / Cleanup
 */
export async function clearSession() {
  cookies().delete(SESSION_COOKIE);
}
