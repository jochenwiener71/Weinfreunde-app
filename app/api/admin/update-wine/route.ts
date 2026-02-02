import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

export async function PATCH(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json().catch(() => ({}));

    const publicSlug = String(body.publicSlug ?? "").trim();
    const wineId = String(body.wineId ?? "").trim();

    if (!publicSlug || !wineId) {
      return NextResponse.json({ error: "Missing publicSlug or wineId" }, { status: 400 });
    }

    const tSnap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tSnap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tDoc = tSnap.docs[0];
    const wRef = tDoc.ref.collection("wines").doc(wineId);

    // normalize fields
    const ownerName = body.ownerName == null ? null : String(body.ownerName).trim() || null;
    const winery = body.winery == null ? null : String(body.winery).trim() || null;
    const grape = body.grape == null ? null : String(body.grape).trim() || null;
    const vintage = body.vintage == null ? null : String(body.vintage).trim() || null;

    const serveOrderRaw = body.serveOrder;
    const serveOrder =
      serveOrderRaw === "" || serveOrderRaw == null
        ? null
        : Number.isFinite(Number(serveOrderRaw))
        ? Number(serveOrderRaw)
        : null;

    // ✅ neu
    const imageUrl = body.imageUrl == null ? null : String(body.imageUrl).trim() || null;

    await wRef.set(
      {
        ownerName,
        winery,
        grape,
        vintage,
        serveOrder,
        imageUrl, // ✅ speichern
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
