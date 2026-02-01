import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json();
    const publicSlug = String(body.publicSlug ?? "").trim();
    const participantId = String(body.participantId ?? "").trim();

    if (!publicSlug || !participantId) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    // find tasting
    const tSnap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tSnap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tRef = tSnap.docs[0].ref;
    const batch = db().batch();

    // 1️⃣ delete ratings of participant
    const rSnap = await tRef
      .collection("ratings")
      .where("participantId", "==", participantId)
      .get();

    rSnap.docs.forEach((doc) => batch.delete(doc.ref));

    // 2️⃣ delete participant
    const pRef = tRef.collection("participants").doc(participantId);
    batch.delete(pRef);

    await batch.commit();

    return NextResponse.json({
      ok: true,
      deletedRatings: rSnap.size,
      participantId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
