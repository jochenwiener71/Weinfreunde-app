import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json().catch(() => ({}));
    const publicSlug = String(body?.publicSlug ?? "").trim();
    const participantId = String(body?.participantId ?? "").trim();

    if (!publicSlug || !participantId) {
      return NextResponse.json({ error: "Missing publicSlug or participantId" }, { status: 400 });
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

    const tDoc = tSnap.docs[0];
    const tRef = tDoc.ref;

    // delete participant doc
    await tRef.collection("participants").doc(participantId).delete();

    // best-effort: delete ratings by this participant (if ratings docs store participantId)
    // (Deine debugSamples zeigen participantId Feld -> passt)
    const rSnap = await tRef
      .collection("ratings")
      .where("participantId", "==", participantId)
      .limit(500)
      .get();

    if (!rSnap.empty) {
      const batch = db().batch();
      rSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId: tDoc.id,
      deletedParticipantId: participantId,
      deletedRatings: rSnap.size,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
