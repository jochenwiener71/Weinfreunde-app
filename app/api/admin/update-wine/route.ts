import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

export async function PATCH(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json();

    const publicSlug = String(body.publicSlug ?? "").trim();
    const wineId = String(body.wineId ?? "").trim();
    if (!publicSlug || !wineId) {
      return NextResponse.json({ error: "Missing publicSlug or wineId" }, { status: 400 });
    }

    // tasting by slug
    const snap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tastingId = snap.docs[0].id;

    // ✅ allow these fields (including image)
    const patch: any = {
      ownerName: body.ownerName ?? null,
      winery: body.winery ?? null,
      grape: body.grape ?? null,
      vintage: body.vintage ?? null,
      serveOrder: typeof body.serveOrder === "number" ? body.serveOrder : (body.serveOrder ?? null),

      // ✅ NEW
      imageUrl: body.imageUrl ?? null,
      imagePath: body.imagePath ?? null,

      updatedAt: new Date(),
    };

    await db()
      .collection("tastings")
      .doc(tastingId)
      .collection("wines")
      .doc(wineId) // ✅ AutoID doc
      .set(patch, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
