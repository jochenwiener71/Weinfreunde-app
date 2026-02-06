import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

async function getTastingDocByPublicSlug(publicSlug: string) {
  const snap = await db()
    .collection("tastings")
    .where("publicSlug", "==", publicSlug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0];
}

// Optional: löscht auch Ratings des Teilnehmers (damit Reporting sauber bleibt)
async function deleteRatingsForParticipant(
  tastingRef: admin.firestore.DocumentReference,
  participantId: string
) {
  const ratingsRef = tastingRef.collection("ratings");
  const q = await ratingsRef.where("participantId", "==", participantId).get();
  if (q.empty) return 0;

  let deleted = 0;
  let batch = db().batch();
  let ops = 0;

  for (const doc of q.docs) {
    batch.delete(doc.ref);
    ops++;
    deleted++;

    // Firestore Batch limit ~500
    if (ops >= 450) {
      await batch.commit();
      batch = db().batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  return deleted;
}

export async function DELETE(req: Request) {
  try {
    requireAdminSecret(req);

    const { searchParams } = new URL(req.url) ;
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();
    const participantId = String(searchParams.get("participantId") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }
    if (!participantId) {
      return NextResponse.json({ error: "Missing participantId" }, { status: 400 });
    }

    const tDoc = await getTastingDocByPublicSlug(publicSlug);
    if (!tDoc) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const pRef = tDoc.ref.collection("participants").doc(participantId);
    const pSnap = await pRef.get();
    if (!pSnap.exists) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // 1) Participant löschen
    await pRef.delete();

    // 2) Optional Ratings löschen
    const ratingsDeleted = await deleteRatingsForParticipant(tDoc.ref, participantId);

    return NextResponse.json({ ok: true, ratingsDeleted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
