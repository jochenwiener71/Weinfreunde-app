import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";
import admin from "firebase-admin";

export async function PATCH(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json();

    const publicSlug = String(body.publicSlug ?? "").trim();
    const wineId = String(body.wineId ?? "").trim();

    if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    if (!wineId) return NextResponse.json({ error: "Missing wineId" }, { status: 400 });

    // 1) tasting by publicSlug
    const snap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (snap.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

    const tastingDoc = snap.docs[0];
    const tastingId = tastingDoc.id;

    // 2) update exactly ONE wine doc
    const wineRef = db().collection("tastings").doc(tastingId).collection("wines").doc(wineId);

    const patch: any = {
      ownerName: typeof body.ownerName === "string" ? body.ownerName : null,
      winery: typeof body.winery === "string" ? body.winery : null,
      grape: typeof body.grape === "string" ? body.grape : null,
      vintage: typeof body.vintage === "string" ? body.vintage : null,
      serveOrder: typeof body.serveOrder === "number" ? body.serveOrder : null,

      // ✅ important: persist image fields
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
      imagePath: typeof body.imagePath === "string" ? body.imagePath : null,

      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await wineRef.set(patch, { merge: true });

    return NextResponse.json({ ok: true, tastingId, wineId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
