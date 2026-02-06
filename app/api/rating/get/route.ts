// app/api/rating/get/route.ts
import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { getSession } from "@/lib/session";

type ScoresMap = Record<string, number>;

function safeInt(v: any, fallback: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const slug = String(searchParams.get("slug") ?? "").trim();
    const blindNumber = safeInt(searchParams.get("blindNumber"), 0);

    if (!slug || !blindNumber || blindNumber < 1) {
      return NextResponse.json({ ok: false, error: "Missing slug or blindNumber" }, { status: 400 });
    }

    // ✅ Session (participant) muss existieren – sonst "Not logged in"
    const session = await getSession();
    const tastingIdFromSession = (session as any)?.tastingId ?? null;
    const participantId = (session as any)?.participantId ?? null;

    if (!participantId) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }

    // ✅ Tasting per slug finden
    const q = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    if (q.empty) {
      return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });
    }

    const tastingDoc = q.docs[0];
    const tastingId = tastingDoc.id;

    // 🔒 Optional: session muss zum slug passen (verhindert, dass man mit Session aus anderem Tasting liest)
    if (tastingIdFromSession && tastingIdFromSession !== tastingId) {
      return NextResponse.json({ ok: false, error: "Session does not match this tasting" }, { status: 403 });
    }

    // ✅ Rating suchen (robust: egal welches Doc-ID-Schema)
    // Erwartetes Schema (von save): tasting/{tastingId}/ratings (mit Feldern participantId, blindNumber, scores, comment)
    const ratingsRef = tastingDoc.ref.collection("ratings");

    const rSnap = await ratingsRef
      .where("participantId", "==", participantId)
      .where("blindNumber", "==", blindNumber)
      .limit(1)
      .get();

    if (rSnap.empty) {
      return NextResponse.json({
        ok: true,
        found: false,
        slug,
        tastingId,
        participantId,
        blindNumber,
        scores: {} as ScoresMap,
        comment: "",
      });
    }

    const rDoc = rSnap.docs[0];
    const data = rDoc.data() as any;

    const scores: ScoresMap =
      data?.scores && typeof data.scores === "object" && !Array.isArray(data.scores) ? data.scores : {};

    const comment = typeof data?.comment === "string" ? data.comment : "";

    return NextResponse.json({
      ok: true,
      found: true,
      slug,
      tastingId,
      participantId,
      blindNumber,
      ratingId: rDoc.id,
      scores,
      comment,
      updatedAt: data?.updatedAt ?? null,
      createdAt: data?.createdAt ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
