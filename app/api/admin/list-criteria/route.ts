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

export async function GET(req: Request) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const publicSlug = (searchParams.get("publicSlug") || "").trim();
    if (!publicSlug) throw new Error("publicSlug missing");

    const tastingRef = await tastingRefBySlug(publicSlug);

    const critSnap = await tastingRef.collection("criteria").orderBy("order", "asc").get();

    const criteria = critSnap.docs.map((d) => ({
      id: d.id,
      title: d.get("title") ?? "",
      weight: d.get("weight") ?? 0,
      order: d.get("order") ?? 0,
      isActive: d.get("isActive") ?? true,
    }));

    return NextResponse.json({ criteria });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 400 });
  }
}
