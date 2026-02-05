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

type UpsertBody = {
  publicSlug: string;
  adminSecret: string;
  criterion: {
    id?: string;
    name: string;          // z.B. "Nase"
    weight?: number;       // z.B. 0.2
    order?: number;        // z.B. 1..n
    active?: boolean;      // true/false
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpsertBody;

    const publicSlug = String(body?.publicSlug ?? "").trim();
    const adminSecret = body?.adminSecret ?? null;
    const c = body?.criterion;

    if (!publicSlug) return NextResponse.json({ ok: false, error: "Missing publicSlug" }, { status: 400 });
    if (!c || !String(c.name ?? "").trim()) {
      return NextResponse.json({ ok: false, error: "Missing criterion.name" }, { status: 400 });
    }

    assertAdmin(adminSecret);

    const tastingRef = await getTastingRefByPublicSlug(publicSlug);
    if (!tastingRef) return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });

    const id = (c.id ?? "").trim() || tastingRef.collection("criteria").doc().id;

    const payload = {
      name: String(c.name).trim(),
      weight: typeof c.weight === "number" ? c.weight : 0,
      order: typeof c.order === "number" ? c.order : 0,
      active: typeof c.active === "boolean" ? c.active : true,
      updatedAt: new Date().toISOString(),
    };

    await tastingRef.collection("criteria").doc(id).set(payload, { merge: true });

    return NextResponse.json({ ok: true, id, criterion: payload });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
