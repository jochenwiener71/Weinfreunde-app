import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireSession } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const session = requireSession();

    const { searchParams } = new URL(req.url);
    const slug = String(searchParams.get("slug") ?? "").trim();
    const blindNumber = Number(searchParams.get("blindNumber"));

    if (!slug || !Number.isFinite(blindNumber) || blindNumber < 1) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const q = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    if (q.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

    const tastingDoc = q.docs[0];

    const ratingId = `${session.participantId}_wine_${blindNumber}`;
    const ref = tastingDoc.ref.collection("ratings").doc(ratingId);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ ok: true, exists: false, rating: null });
    }

    const data = snap.data() as any;

    return NextResponse.json({
      ok: true,
      exists: true,
      rating: {
        id: snap.id,
        participantId: data?.participantId ?? null,
        blindNumber: data?.blindNumber ?? blindNumber,
        scores: data?.scores ?? {},
        comment: data?.comment ?? "",
        updatedAt: data?.updatedAt ?? null,
        createdAt: data?.createdAt ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Get failed" }, { status: 500 });
  }
}
