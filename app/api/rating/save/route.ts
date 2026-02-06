import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireSession } from "@/lib/session";

type ScoresMap = Record<string, number>;

export async function POST(req: Request) {
  try {
    const session = requireSession();

    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug ?? "").trim();
    const blindNumber = Number(body.blindNumber);
    const scores: ScoresMap = body.scores ?? {};
    const comment = String(body.comment ?? "").trim();

    if (!slug || !Number.isFinite(blindNumber) || blindNumber < 1) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const q = await db().collection("tastings").where("publicSlug", "==", slug).limit(1).get();
    if (q.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

    const tastingDoc = q.docs[0];

    // simple upsert: ratings/{participantId_wineX}
    const ratingId = `${session.participantId}_wine_${blindNumber}`;
    const ref = tastingDoc.ref.collection("ratings").doc(ratingId);

    await ref.set(
      {
        participantId: session.participantId,
        blindNumber,
        scores,
        comment: comment || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Save failed" }, { status: 500 });
  }
}
