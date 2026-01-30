import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "../../../../lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-admin-secret") ?? "";
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const tastingId = String(body.tastingId ?? "").trim();
    const wines = body.wines;

    if (!tastingId) {
      return NextResponse.json({ error: "Missing tastingId" }, { status: 400 });
    }
    if (!Array.isArray(wines)) {
      return NextResponse.json({ error: "Missing wines array" }, { status: 400 });
    }

    const tRef = db().collection("tastings").doc(tastingId);
    const batch = db().batch();

    for (const w of wines) {
      const wineId = String(w.wineId ?? "").trim();
      if (!wineId) continue;

      batch.set(
        tRef.collection("wines").doc(wineId),
        {
          displayName: w.displayName ?? null,
          winery: w.winery ?? null,
          grape: w.grape ?? null,
          vintage: w.vintage ?? null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    batch.set(
      tRef,
      {
        status: "revealed",
        revealedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Reveal failed" }, { status: 500 });
  }
}
