import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

async function getTastingRefByPublicSlug(publicSlug: string) {
  const snap = await db
    .collection("tastings")
    .where("publicSlug", "==", publicSlug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].ref;
}

function assertAdmin(reqSecret: string | null) {
  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  if (!expected) throw new Error("Server misconfigured: ADMIN_SECRET is not set.");
  if (!reqSecret || reqSecret.trim() !== expected) throw new Error("Unauthorized: invalid ADMIN_SECRET.");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const publicSlug = (url.searchParams.get("publicSlug") ?? "").trim();
    const adminSecret = url.searchParams.get("adminSecret");

    if (!publicSlug) {
      return NextResponse.json({ ok: false, error: "Missing publicSlug" }, { status: 400 });
    }

    assertAdmin(adminSecret);

    const tastingRef = await getTastingRefByPublicSlug(publicSlug);
    if (!tastingRef) {
      return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });
    }

    const critSnap = await tastingRef.collection("criteria").orderBy("order", "asc").get();
    const criteria = critSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ ok: true, criteria });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
