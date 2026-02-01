import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

function requireAdminSecret(req: Request) {
  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  const provided = req.headers.get("x-admin-secret") || req.headers.get("X-Admin-Secret") || "";
  if (!expected) throw new Error("ADMIN_SECRET is not set in this deployment.");
  if (!provided || String(provided).trim() !== expected) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

async function deleteSubcollection(ref: admin.firestore.DocumentReference, sub: string) {
  const col = ref.collection(sub);
  while (true) {
    const snap = await col.limit(200).get();
    if (snap.empty) break;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json().catch(() => ({}));
    const publicSlug = String(body?.publicSlug ?? "").trim();
    const tastingId = String(body?.tastingId ?? "").trim();

    let ref: admin.firestore.DocumentReference | null = null;

    if (tastingId) {
      ref = db().collection("tastings").doc(tastingId);
      const s = await ref.get();
      if (!s.exists) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    } else if (publicSlug) {
      const q = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
      if (q.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
      ref = q.docs[0].ref;
    } else {
      return NextResponse.json({ error: "Missing publicSlug or tastingId" }, { status: 400 });
    }

    // known subcollections
    await deleteSubcollection(ref!, "wines");
    await deleteSubcollection(ref!, "criteria");
    await deleteSubcollection(ref!, "ratings");
    await deleteSubcollection(ref!, "participants");
    await deleteSubcollection(ref!, "reports");

    await ref!.delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status ?? 500);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status });
  }
}
