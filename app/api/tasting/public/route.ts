import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const q = await db()
    .collection("tastings")
    .where("publicSlug", "==", slug)
    .limit(1)
    .get();

  if (q.empty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = q.docs[0];
  const t = doc.data() as any;

  const [criteriaSnap, winesSnap] = await Promise.all([
    doc.ref.collection("criteria").orderBy("order", "asc").get(),
    doc.ref.collection("wines").orderBy("blindNumber", "asc").get(),
  ]);

  // ✅ Vereinfachung: IMMER Details ausgeben (unabhängig vom Status)
  return NextResponse.json({
    tasting: {
      id: doc.id,
      publicSlug: t.publicSlug,
      title: t.title,
      hostName: t.hostName,
      status: t.status,
      wineCount: t.wineCount ?? 10,
      maxParticipants: t.maxParticipants ?? 10,
    },
    criteria: criteriaSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
    wines: winesSnap.docs.map((d) => {
      const w = d.data() as any;
      return {
        id: d.id,
        blindNumber: w.blindNumber,
        isActive: w.isActive ?? true,

        // ✅ immer sichtbar
        displayName: w.displayName ?? null,
        winery: w.winery ?? null,
        grape: w.grape ?? null,
        vintage: w.vintage ?? null,
        ownerName: w.ownerName ?? null,
        serveOrder: w.serveOrder ?? null,

        // ✅ Bilder immer sichtbar
        imageUrl: w.imageUrl ?? null,
        imagePath: w.imagePath ?? null,
      };
    }),
  });
}
