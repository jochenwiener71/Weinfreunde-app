import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "../../../lib/firebaseAdmin";
import { requireSession } from "../../../../lib/session";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();
    const blindNumber = Number(body.blindNumber);
    const scores = body.scores ?? {};
    const comment = String(body.comment ?? "").trim();

    if (!Number.isInteger(blindNumber) || blindNumber < 1 || blindNumber > 10) {
      return NextResponse.json({ error: "Invalid blindNumber" }, { status: 400 });
    }
    if (typeof scores !== "object" || Array.isArray(scores)) {
      return NextResponse.json({ error: "scores must be an object" }, { status: 400 });
    }

    const winesQ = await db()
      .collection("tastings")
      .doc(session.tastingId)
      .collection("wines")
      .where("blindNumber", "==", blindNumber)
      .limit(1)
      .get();

    if (winesQ.empty) {
      return NextResponse.json({ error: "Wine not found" }, { status: 404 });
    }

    const wineId = winesQ.docs[0].id;
    const ratingId = `${session.participantId}_${wineId}`;

    await db()
      .collection("tastings")
      .doc(session.tastingId)
      .collection("ratings")
      .doc(ratingId)
      .set(
        {
          participantId: session.participantId,
          wineId,
          scores,
          comment: comment || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Save failed" }, { status: 500 });
  }
}
