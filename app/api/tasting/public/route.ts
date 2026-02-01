import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") ?? "").trim();

  // OPTIONAL: für Bewertungsseite (liefert zusätzlich "wine" zurück)
  const blindNumberRaw = String(searchParams.get("blindNumber") ?? "").trim();
  const blindNumber = blindNumberRaw ? Number(blindNumberRaw) : null;

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

  // ✅ Details auch bei OPEN anzeigen
  const showDetails = t.status === "open" || t.status === "revealed";

  const wines = winesSnap.docs.map((d) => {
    const w = d.data() as any;

    const base: any = {
      id: d.id,
      blindNumber: w.blindNumber ?? null,
      isActive: w.isActive ?? true,
    };

    if (showDetails) {
      base.displayName = w.displayName ?? null;
      base.winery = w.winery ?? null;
      base.grape = w.grape ?? null;
      base.vintage = w.vintage ?? null;

      // falls du das später brauchst:
      base.ownerName = w.ownerName ?? null;
      base.serveOrder = w.serveOrder ?? null;
    }

    return base;
  });

  // OPTIONAL: einzelner Wein für Bewertungsseite
  const wine =
    typeof blindNumber === "number" && Number.isFinite(blindNumber)
      ? wines.find((w) => w.blindNumber === blindNumber) ?? null
      : null;

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
    wines,
    wine, // <-- neu (optional)
  });
}
