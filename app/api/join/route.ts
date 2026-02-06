import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { verifyPin } from "@/lib/security";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const slug = String(body.slug ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    const aliasRaw = String(body.alias ?? "").trim();

    const alias = aliasRaw ? aliasRaw.slice(0, 40) : "";

    if (!slug || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const q = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    if (q.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tastingDoc = q.docs[0];
    const tasting = tastingDoc.data() as any;

    if (String(tasting.status ?? "") !== "open") {
      return NextResponse.json({ error: "Tasting not open" }, { status: 403 });
    }

    if (!verifyPin(pin, tasting.pinHash)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const maxParticipants = Number(tasting.maxParticipants ?? 10);

    // ✅ Atomar: verhindert Race-Conditions (gleichzeitige Joins)
    const participantsRef = tastingDoc.ref.collection("participants");

    const result = await db().runTransaction(async (tx) => {
      const snap = await tx.get(participantsRef);
      if (snap.size >= maxParticipants) {
        return { ok: false as const, error: "Tasting full", status: 409 };
      }

      const pRef = participantsRef.doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.set(
        pRef,
        {
          // ✅ Standardisieren: Name-Feld, damit Admin-UI immer was anzeigen kann
          name: alias || `Teilnehmer ${snap.size + 1}`,
          alias: alias || `Teilnehmer ${snap.size + 1}`,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      return { ok: true as const, participantId: pRef.id };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // ✅ Session cookie setzen
    await createSession({ tastingId: tastingDoc.id, participantId: result.participantId });

    return NextResponse.json({ ok: true, participantId: result.participantId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Join failed" }, { status: 500 });
  }
}
