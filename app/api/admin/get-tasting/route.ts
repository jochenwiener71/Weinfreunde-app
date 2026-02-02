import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

type WineSlot = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;

  // ✅ bottle photo
  imageUrl: string | null;
  imagePath: string | null;
};

function toWineSlot(doc: admin.firestore.QueryDocumentSnapshot): WineSlot {
  const wd = doc.data() as any;
  return {
    id: doc.id,
    blindNumber: typeof wd.blindNumber === "number" ? wd.blindNumber : null,
    serveOrder: typeof wd.serveOrder === "number" ? wd.serveOrder : null,
    ownerName: typeof wd.ownerName === "string" ? wd.ownerName : null,
    winery: typeof wd.winery === "string" ? wd.winery : null,
    grape: typeof wd.grape === "string" ? wd.grape : null,
    vintage: typeof wd.vintage === "string" ? wd.vintage : null,
    imageUrl: typeof wd.imageUrl === "string" ? wd.imageUrl : null,
    imagePath: typeof wd.imagePath === "string" ? wd.imagePath : null,
  };
}

async function ensureWineDocsExist(tastingRef: admin.firestore.DocumentReference, wineCount: number) {
  if (!wineCount || wineCount < 1) return;

  const winesRef = tastingRef.collection("wines");
  const existingSnap = await winesRef.limit(1).get();
  if (!existingSnap.empty) return; // ✅ already exists

  // ✅ Create placeholder wines 1..wineCount
  // (Batch limit 500; your wineCount will be far below that)
  const batch = db().batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (let i = 1; i <= wineCount; i++) {
    const docRef = winesRef.doc(); // auto id
    batch.set(
      docRef,
      {
        blindNumber: i,
        serveOrder: null,
        ownerName: null,
        winery: null,
        grape: null,
        vintage: null,
        imageUrl: null,
        imagePath: null,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function GET(req: Request) {
  try {
    requireAdminSecret(req);

    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    const tSnap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tSnap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tDoc = tSnap.docs[0];
    const tastingId = tDoc.id;
    const tData = tDoc.data() as any;

    const wineCountFromDoc =
      typeof tData.wineCount === "number" && tData.wineCount > 0 ? tData.wineCount : 0;

    // ✅ IMPORTANT: ensure wines exist (only if wineCount > 0 and wines are missing)
    await ensureWineDocsExist(tDoc.ref, wineCountFromDoc);

    // ✅ read wines
    const winesSnap = await tDoc.ref.collection("wines").get();

    const wines: WineSlot[] = winesSnap.docs
      .map(toWineSlot)
      .sort((a, b) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999));

    return NextResponse.json({
      ok: true,
      tastingId,
      publicSlug: tData.publicSlug ?? publicSlug,
      title: tData.title ?? null,
      hostName: tData.hostName ?? null,
      status: tData.status ?? null,
      wineCount: wineCountFromDoc || wines.length,
      maxParticipants: tData.maxParticipants ?? null,
      wines,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
