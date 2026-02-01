import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

async function findTasting(body: any) {
  const tastingId = String(body?.tastingId ?? "").trim();
  const publicSlug = String(body?.publicSlug ?? "").trim();

  if (tastingId) {
    const ref = db().collection("tastings").doc(tastingId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    return { ref, id: snap.id, data: snap.data() };
  }

  if (publicSlug) {
    const q = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
    if (q.empty) return null;
    return { ref: q.docs[0].ref, id: q.docs[0].id, data: q.docs[0].data() };
  }

  return null;
}

async function deleteCollection(ref: admin.firestore.CollectionReference, batchSize = 250) {
  let deleted = 0;

  while (true) {
    const snap = await ref
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(batchSize)
      .get();

    if (snap.empty) break;

    const batch = db().batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();

    deleted += snap.size;

    // safety: if less than batchSize, we're done
    if (snap.size < batchSize) break;
  }

  return deleted;
}

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json().catch(() => ({}));

    const found = await findTasting(body);
    if (!found) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tastingRef = found.ref;

    // delete subcollections
    const deletedCounts: Record<string, number> = {};

    deletedCounts.criteria = await deleteCollection(tastingRef.collection("criteria"));
    deletedCounts.wines = await deleteCollection(tastingRef.collection("wines"));
    deletedCounts.ratings = await deleteCollection(tastingRef.collection("ratings"));
    deletedCounts.participants = await deleteCollection(tastingRef.collection("participants"));

    // finally delete tasting doc
    await tastingRef.delete();

    return NextResponse.json({
      ok: true,
      tastingId: found.id,
      deletedCounts,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Delete failed" }, { status: 500 });
  }
}
