import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

async function getTastingRefByPublicSlug(
  publicSlug: string
): Promise<admin.firestore.DocumentReference | null> {
  const snap = await db()
    .collection("tastings")
    .where("publicSlug", "==", publicSlug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].ref;
}

export async function GET(req: Request) {
  try {
    // ✅ Einheitlicher Admin-Check (Header: x-admin-secret)
    requireAdminSecret(req);

    const url = new URL(req.url);
    const publicSlug = (url.searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing publicSlug" },
        { status: 400 }
      );
    }

    const tastingRef = await getTastingRefByPublicSlug(publicSlug);
    if (!tastingRef) {
      return NextResponse.json(
        { ok: false, error: "Tasting not found" },
        { status: 404 }
      );
    }

    const critSnap = await tastingRef
      .collection("criteria")
      .orderBy("order", "asc")
      .get();

    const criteria = critSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ ok: true, criteria });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
