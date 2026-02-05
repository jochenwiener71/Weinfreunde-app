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
    const c = body?.criterion || {};

    if (!publicSlug) throw new Error("publicSlug missing");
    if (!String(c.title || "").trim()) throw new Error("criterion.title missing");

    const tastingRef = await tastingRefBySlug(publicSlug);

    const data = {
      title: String(c.title).trim(),
      weight: Number(c.weight ?? 0),
      order: Number(c.order ?? 0),
      isActive: !!c.isActive,
      updatedAt: new Date(),
    };

    let ref;
    if (c.id) {
      ref = tastingRef.collection("criteria").doc(String(c.id));
      await ref.set(data, { merge: true });
    } else {
      ref = await tastingRef.collection("criteria").add({
        ...data,
        createdAt: new Date(),
      });
    }

    const saved = await ref.get();

    return NextResponse.json({
      criterion: {
        id: saved.id,
        title: saved.get("title") ?? "",
        weight: saved.get("weight") ?? 0,
        order: saved.get("order") ?? 0,
        isActive: saved.get("isActive") ?? true,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 400 });
  }
}
