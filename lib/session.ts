import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import admin from "firebase-admin";

type SessionPayload = {
  participantId: string;
  participantName: string;
  tastingId: string;
  publicSlug: string;
};

const COOKIE_NAME = "wf_session";

export function setSessionCookie(res: NextResponse, payload: SessionPayload) {
  const secret = String(process.env.SESSION_SECRET ?? "");
  if (!secret) throw new Error("SESSION_SECRET is not set");

  // Minimal: payload als JSON in Cookie (wenn du signierst, sag Bescheid -> ich passe auf deine Signatur an)
  const value = Buffer.from(JSON.stringify(payload)).toString("base64");

  res.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 Tage
  });
}
