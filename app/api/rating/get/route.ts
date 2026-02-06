import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireSession } from "@/lib/session";

export async function GET(req: Request) {
  try {
    // 🔐 muss eingeloggt sein (Session-Cookie)
    const session = await requireSession();

    const { searchParams } = new URL(req.url);
    const slug = String(searchParams.get("slug") ?? "").trim();
    const blindNumberRaw = String(searchParams.get("blindNumber") ?? "").trim();
    const blindNumber = Number(blindNumberRaw);

    if (!slug || !Number.isFinite(blindNumber) || blindNumber < 1) {
      return NextResponse.json({ ok: false, error: "Invalid slug/blindNumber" }, { status: 400 });
    }

    // tasting finden
    const tq = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    if (tq.empty) {
      return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });
    }

    const tastingDoc = tq.docs[0];

    // ✅ WICHTIG:
    // Wir lesen die Bewertung aus tastings/{tastingId}/ratings/{participantId_blindNumber}
    const ratingId = `${session.participantId}_${blindNumber}`;
    const rSnap = await tastingDoc.ref.collection("ratings").doc(ratingId).get();

    if (!rSnap.exists) {
      return NextResponse.json({ ok: true, rating: null });
    }

    const r = rSnap.data() as any;

    return NextResponse.json({
      ok: true,
      rating: {
        id: rSnap.id,
        participantId: r?.participantId ?? session.participantId,
        blindNumber: r?.blindNumber ?? blindNumber,
        scores: r?.scores ?? {},
        comment: typeof r?.comment === "string" ? r.comment : "",
        updatedAt: r?.updatedAt ?? null,
      },
    });
  } catch (e: any) {
    // requireSession wirft "Not logged in"
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 401 });
  }
}
