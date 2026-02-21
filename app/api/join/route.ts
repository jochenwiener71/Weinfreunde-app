// app/api/join/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { setSessionCookie } from "@/lib/session";
import { verifyPin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const rawSlug = String(body.slug ?? "").trim();
    const name = String(body.name ?? "").trim();
    const pin = String(body.pin ?? "").trim();

    if (!rawSlug || !name || !pin) {
      return NextResponse.json(
        { ok: false, error: "Missing slug/name/pin" },
        { status: 400 }
      );
    }

    // 🔒 Slug robust behandeln (Case-safe)
    const slugLower = rawSlug.toLowerCase();

    let tq = await db()
      .collection("tastings")
      .where("publicSlug", "==", rawSlug)
      .limit(1)
      .get();

    // Fallback falls DB lowercase speichert
    if (tq.empty && slugLower !== rawSlug) {
      tq = await db()
        .collection("tastings")
        .where("publicSlug", "==", slugLower)
        .limit(1)
        .get();
    }

    if (tq.empty) {
      return NextResponse.json(
        { ok: false, error: "Tasting not found" },
        { status: 404 }
      );
    }

    const tastingDoc = tq.docs[0];

    // Teilnehmer suchen
    const pq = await tastingDoc.ref
      .collection("participants")
      .where("name", "==", name)
      .limit(1)
      .get();

    if (pq.empty) {
      return NextResponse.json(
        { ok: false, error: "Teilnehmer nicht gefunden" },
        { status: 401 }
      );
    }

    const participantDoc = pq.docs[0];
    const p = participantDoc.data() as any;

    // PIN prüfen (hash)
    if (!verifyPin(pin, p.pinHash)) {
      return NextResponse.json(
        { ok: false, error: "PIN falsch" },
        { status: 401 }
      );
    }

    // Session setzen
    const res = NextResponse.json({ ok: true });

    setSessionCookie(res, {
      participantId: participantDoc.id,
      participantName: p.name,
      tastingId: tastingDoc.id,
      publicSlug: (tastingDoc.data() as any).publicSlug,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Join failed" },
      { status: 500 }
    );
  }
}
