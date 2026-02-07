import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "tasting_session";

/**
 * Struktur der Session
 */
export type TastingSession = {
  tastingId: string;
  participantId: string;
  name: string;
  iat: number;
  nonce: string;
};

/**
 * Erstellt eine neue Teilnehmer-Session (z. B. beim Join oder Weiterbewerten)
 */
export function createSession(data: {
  tastingId: string;
  participantId: string;
  name: string;
}) {
  const payload: TastingSession = {
    ...data,
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  cookies().set({
    name: SESSION_COOKIE,
    value: encoded,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
  });
}

/**
 * Liest die Session oder wirft einen Fehler (für API-Routen)
 */
export function requireSession(): TastingSession {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) {
    throw new Error("Not logged in");
  }

  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString());
  } catch {
    throw new Error("Invalid session");
  }
}

/**
 * Optional: Session prüfen ohne Error (für UI/Status-Abfragen)
 */
export function getSession(): TastingSession | null {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString());
  } catch {
    return null;
  }
}

/**
 * Optional: Session löschen (Logout / Reset)
 */
export function clearSession() {
  cookies().set({
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
}
