import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

type WineSlotPublic = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;

  imageUrl: string | null;
  imagePath: string | null;
};

function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Baut eine dauerhaft nutzbare Read-URL aus einem Storage-Pfad.
 * -> Signed URL (robust, keine Public Rules nötig)
 */
async function getReadUrlFromPath(path: string): Promise<string | null> {
  try {
    const bucket = admin.storage().bucket(); // nutzt storageBucket aus initializeApp()
    const file = bucket.file(path);

    const [exists] = await file.exists();
    if (!exists) return null;

    const [url] = await file.getSignedUrl({
      action: "read",
      // sehr weit in der Zukunft -> quasi "permanent" für deine App-Logik
      expires: "2500-01-01",
    });

    return url || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    // find tasting by publicSlug
    const snap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const doc = snap.docs[0];
    const tastingId = doc.id;
    const t = doc.data() as any;

    const status = String(t.status ?? "");
    const wineCount = typeof t.wineCount === "number" ? t.wineCount : null;

    // wines
    const winesSnap = await doc.ref.collection("wines").get();

    // NOTE: Details immer sichtbar (wie du wolltest) -> keine reveal-Logik mehr hier.
    const winesRaw: WineSlotPublic[] = winesSnap.docs
      .map((w) => {
        const wd = w.data() as any;
        return {
          id: w.id,
          blindNumber: numOrNull(wd.blindNumber),
          serveOrder: numOrNull(wd.serveOrder),

          ownerName: strOrNull(wd.ownerName),
          winery: strOrNull(wd.winery),
          grape: strOrNull(wd.grape),
          vintage: strOrNull(wd.vintage),

          imageUrl: strOrNull(wd.imageUrl),
          imagePath: strOrNull(wd.imagePath),
        };
      })
      .sort((a, b) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999));

    // ✅ backfill imageUrl from imagePath if needed
    const wines: WineSlotPublic[] = await Promise.all(
      winesRaw.map(async (w) => {
        if (w.imageUrl) return w;
        if (!w.imagePath) return w;

        const url = await getReadUrlFromPath(w.imagePath);
        return { ...w, imageUrl: url };
      })
    );

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId,
      status,
      wineCount: wineCount ?? wines.length,
      wines,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
