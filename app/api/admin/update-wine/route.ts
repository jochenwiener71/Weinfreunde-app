import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanStr(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function PATCH(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json().catch(() => ({}));

    const publicSlug = String(body.publicSlug ?? "").trim();
    const wineId = String(body.wineId ?? "").trim();

    if (!publicSlug) return jsonError("Missing publicSlug", 400);
    if (!wineId) return jsonError("Missing wineId", 400);

    // find tasting
    const tSnap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tSnap.empty) return jsonError("Tasting not found", 404);

    const tDoc = tSnap.docs[0];
    const tastingId = tDoc.id;

    // patch fields
    const patch: any = {};
    if ("ownerName" in body) patch.ownerName = cleanStr(body.ownerName);
    if ("winery" in body) patch.winery = cleanStr(body.winery);
    if ("grape" in body) patch.grape = cleanStr(body.grape);
    if ("vintage" in body) patch.vintage = cleanStr(body.vintage);

    // optional serveOrder (int)
    if ("serveOrder" in body) {
      const n = body.serveOrder === null || body.serveOrder === "" ? null : Number(body.serveOrder);
      patch.serveOrder = Number.isFinite(n) ? (Number.isInteger(n) ? n : Math.round(n)) : null;
    }

    // optional blindNumber (int) – normalerweise NICHT ändern, aber falls du willst:
    if ("blindNumber" in body) {
      const n = body.blindNumber === null || body.blindNumber === "" ? null : Number(body.blindNumber);
      patch.blindNumber = Number.isFinite(n) ? (Number.isInteger(n) ? n : Math.round(n)) : null;
    }

    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db()
      .collection("tastings")
      .doc(tastingId)
      .collection("wines")
      .doc(wineId)
      .set(patch, { merge: true });

    return NextResponse.json({ ok: true, tastingId, wineId, patch });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}
