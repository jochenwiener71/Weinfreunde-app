import { NextResponse } from "next/server";
import { db } from "@/app/api/firebaseadmin"; // ggf. Pfad bei dir anpassen

function assertAdmin(req: Request) {
  const secret = req.headers.get("x-admin-secret") || "";
  if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET env missing");
  if (secret !== process.env.ADMIN_SECRET) throw new Error("Unauthorized");
}

async function tastingRefBySlug(publicSlug: string) {
  const snap = await db.collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
  if (snap.empty) throw new Error(`Tasting not found for publicSlug=${publicSlug}`);
  return snap.docs[0].ref;
}

export async function POST(req: Request) {
  try {
    assertAdmin(req);

    const body = await req.json();
    const publicSlug = (body?.publicSlug || "").trim();
    const id = (body?.id || "").trim();

    if (!publicSlug) throw new Error("publicSlug missing");
    if (!id) throw new Error("id missing");

    const tastingRef = await tastingRefBySlug(publicSlug);
    await tastingRef.collection("criteria").doc(id).delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 400 });
  }
}
