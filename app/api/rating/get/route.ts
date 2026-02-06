import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireSession } from "@/lib/session";

export async function GET(req: Request) {
  try {
    // 🔐 Session prüfen (Teilnehmer muss eingeloggt sein)
    const session = requireSession();

    const { searchParams } = new URL(req.url);
    const slug = String(searchParams.get("slug") ?? "").trim();
    const blindNumber = Number(searchParams.get("blindNumber"));

    if (!slug || !Number.isFinite(blindNumber) || blindNumber < 1) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    // 🍷 Tasting per publicSlug finden
    const q = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    if (q.empty) {
      return NextResponse.json({
        ok: true,
        exists: false,
      });
    }

    const tastingDoc = q.docs[0];

    // 📄 Rating-ID (konsistent zu /api/rating/save)
    const ratingId = `${session.participantId}_wine_${blindNumber}`;

    const snap = await tastingDoc.ref
      .collection("ratings")
      .doc(ratingId)
      .get();

    if (!snap.exists) {
      return NextResponse.json({
        ok: true,
        exists: false,
      });
    }

    return NextResponse.json({
      ok: true,
      exists: true,
      rating: snap.data(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to load rating" },
      { status: 500 }
    );
  }
}
