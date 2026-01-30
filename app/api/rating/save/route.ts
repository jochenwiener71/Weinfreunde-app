import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "../../../lib/firebaseAdmin";
import { requireSession } from "../../../lib/session";

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
          comment,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Save failed" }, { status: 500 });
  }
}
