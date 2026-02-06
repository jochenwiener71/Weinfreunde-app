import { NextResponse } from "next/server";
import admin from "firebase-admin";
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
        { ok: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    // 🍷 Tasting finden
    const q = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    if (q.empty) {
      return NextResponse.json(
        { ok: false, error: "Tasting not found" },
        { status: 404 }
      );
    }

    const tastingDoc = q.docs[0];

    // 🔑 MUSS exakt zu /api/rating/save passen
    // ratingId = `${participantId}_wine_${blindNumber}`
    const ratingId = `${session.participantId}_wine_${blindNumber}`;

    const doc = await tastingDoc.ref
      .collection("ratings")
      .doc(ratingId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({
        ok: true,
        exists: false,
        rating: null,
      });
    }

    return NextResponse.json({
      ok: true,
      exists: true,
      rating: doc.data() ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Load failed" },
      { status: 500 }
    );
  }
}
