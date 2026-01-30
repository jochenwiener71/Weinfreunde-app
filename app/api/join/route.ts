import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "../../../lib/firebaseAdmin";
import { verifyPin } from "../../../lib/security";
import { createSession } from "../../../lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const slug = String(body.slug ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    const alias = String(body.alias ?? "").trim();

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
    const tasting = tastingDoc.data();

    if (tasting.status !== "open") {
      return NextResponse.json({ error: "Tasting not open" }, { status: 403 });
    }

    if (!verifyPin(pin, tasting.pinHash)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const participantsRef = tastingDoc.ref.collection("participants");
    const snap = await participantsRef.get();

    if (snap.size >= (tasting.maxParticipants ?? 10)) {
      return NextResponse.json({ error: "Tasting full" }, { status: 409 });
    }

    const pRef = participantsRef.doc();
    await pRef.set({
      alias: alias || `Teilnehmer ${snap.size + 1}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await createSession({ tastingId: tastingDoc.id, participantId: pRef.id });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Join failed" }, { status: 500 });
  }
}
