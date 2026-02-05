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

type DeleteBody = {
  publicSlug: string;
  adminSecret: string;
  criterionId: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DeleteBody;

    const publicSlug = String(body?.publicSlug ?? "").trim();
    const adminSecret = body?.adminSecret ?? null;
    const criterionId = String(body?.criterionId ?? "").trim();

    if (!publicSlug) return NextResponse.json({ ok: false, error: "Missing publicSlug" }, { status: 400 });
    if (!criterionId) return NextResponse.json({ ok: false, error: "Missing criterionId" }, { status: 400 });

    assertAdmin(adminSecret);

    const tastingRef = await getTastingRefByPublicSlug(publicSlug);
    if (!tastingRef) return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });

    await tastingRef.collection("criteria").doc(criterionId).delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
