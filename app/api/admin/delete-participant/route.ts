import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

type DeleteResult = {
  path: string;
  attempted: boolean;
  deleted: number;
  note?: string;
};

async function deleteQueryInChunks(qs: FirebaseFirestore.QuerySnapshot) {
  let deleted = 0;
  const docs = qs.docs.slice();

  // Firestore batch limit is 500 ops; be safe with 400
  const CHUNK = 400;

  while (docs.length) {
    const chunk = docs.splice(0, CHUNK);
    const batch = db().batch();
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json().catch(() => ({}));
    const publicSlug = String(body?.publicSlug ?? "").trim();
    const participantId = String(body?.participantId ?? "").trim();

    if (!publicSlug || !participantId) {
      return NextResponse.json(
        { error: "Missing publicSlug or participantId" },
        { status: 400 }
      );
    }

    // 1) find tasting by publicSlug
    const tSnap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tSnap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tDoc = tSnap.docs[0];
    const tRef = tDoc.ref;

    // 2) participant ref
    const pRef = tRef.collection("participants").doc(participantId);
    const pSnap = await pRef.get();
    if (!pSnap.exists) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // 3) Delete participant doc first (or last – egal). Ich mache zuerst doc, dann cleanup.
    await pRef.delete();

    const results: DeleteResult[] = [];

    // Strategy A: tastings/{tId}/ratings where participantId == participantId
    try {
      const qs = await tRef.collection("ratings").where("participantId", "==", participantId).get();
      const deleted = await deleteQueryInChunks(qs);
      results.push({ path: "tastings/{tId}/ratings (participantId)", attempted: true, deleted });
    } catch (e: any) {
      results.push({
        path: "tastings/{tId}/ratings (participantId)",
        attempted: true,
        deleted: 0,
        note: e?.message ?? "failed",
      });
    }

    // Strategy B: tastings/{tId}/ratings where participant == participantId
    try {
      const qs = await tRef.collection("ratings").where("participant", "==", participantId).get();
      const deleted = await deleteQueryInChunks(qs);
      results.push({ path: "tastings/{tId}/ratings (participant)", attempted: true, deleted });
    } catch (e: any) {
      results.push({
        path: "tastings/{tId}/ratings (participant)",
        attempted: true,
        deleted: 0,
        note: e?.message ?? "failed",
      });
    }

    // Strategy C: tastings/{tId}/ratings where participantRef == <DocumentReference>
    // (nur falls du refs speicherst)
    try {
      const qs = await tRef.collection("ratings").where("participantRef", "==", pRef).get();
      const deleted = await deleteQueryInChunks(qs);
      results.push({ path: "tastings/{tId}/ratings (participantRef)", attempted: true, deleted });
    } catch (e: any) {
      results.push({
        path: "tastings/{tId}/ratings (participantRef)",
        attempted: true,
        deleted: 0,
        note: e?.message ?? "failed",
      });
    }

    // Strategy D: Subcollection participants/{pId}/ratings
    // (falls du Ratings direkt unter dem Participant speicherst)
    try {
      const qs = await pRef.collection("ratings").get();
      let deleted = 0;

      // docs löschen
      const docs = qs.docs.slice();
      const CHUNK = 400;
      while (docs.length) {
        const chunk = docs.splice(0, CHUNK);
        const batch = db().batch();
        for (const d of chunk) batch.delete(d.ref);
        await batch.commit();
        deleted += chunk.length;
      }

      results.push({ path: "tastings/{tId}/participants/{pId}/ratings", attempted: true, deleted });
    } catch (e: any) {
      results.push({
        path: "tastings/{tId}/participants/{pId}/ratings",
        attempted: true,
        deleted: 0,
        note: e?.message ?? "failed",
      });
    }

    const totalRatingsDeleted = results.reduce((sum, r) => sum + (r.deleted ?? 0), 0);

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId: tDoc.id,
      participantId,
      deletedParticipant: true,
      deletedRatings: totalRatingsDeleted,
      strategies: results,
      serverTime: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
