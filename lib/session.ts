import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "tasting_session";

/**
 * Session-Payload, die im Cookie gespeichert wird
 */
export type SessionData = {
  tastingId: string;
  participantId: string;
  name: string;
};

/**
 * 🔐 Session-Cookie setzen
 */
export async function createSession(data: SessionData) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not set");
  }

  const payload = JSON.stringify({
    ...data,
    iat: Date.now(),
  });

  const secret = process.env.SESSION_SECRET;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const value = Buffer.from(
    JSON.stringify({ payload, signature })
  ).toString("base64");

  cookies().set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
  });
}

/**
 * 🔍 Session lesen & validieren
 */
export function getSession(): SessionData | null {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie) return null;

  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not set");
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cookie.value, "base64").toString("utf8")
    );

    const { payload, signature } = decoded;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.SESSION_SECRET)
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) return null;

    const data = JSON.parse(payload);

    return {
      tastingId: data.tastingId,
      participantId: data.participantId,
      name: data.name,
    };
  } catch {
    return null;
  }
}

/**
 * 🚪 Session löschen (Logout / Reset)
 */
export function clearSession() {
  cookies().set({
    name: COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });
}
