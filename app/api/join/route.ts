import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { verifyPin } from "@/lib/security";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { publicSlug, name, pin } = body ?? {};

    if (!publicSlug || !name || !pin) {
      return NextResponse.json(
        { ok: false, error: "Missing publicSlug, name or pin" },
        { status: 400 }
      );
    }

    // 🔎 Tasting laden
    const snap = await db()
      .collection("tastings")
      .where("publicSlug", "==", String(publicSlug))
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { ok: false, error: "Tasting not found" },
        { status: 404 }
      );
    }

    const tastingDoc = snap.docs[0];

    // 🔐 PIN prüfen (RICHTIGE Signatur: 3 Parameter)
    const result = await verifyPin(
      tastingDoc.id,
      String(name).trim(),
      String(pin).trim()
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid name or PIN" },
        { status: 401 }
      );
    }

    // ✅ Session setzen
    await createSession({
      tastingId: tastingDoc.id,
      participantId: result.participantId,
      name: result.name,
    });

    return NextResponse.json({
      ok: true,
      participantId: result.participantId,
      name: result.name,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Join failed" },
      { status: 500 }
    );
  }
}
