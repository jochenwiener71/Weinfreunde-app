import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function signedUrlForPath(path: string | null) {
  if (!path) return null;

  // ✅ MUSS in Vercel gesetzt sein
  const bucketName = String(process.env.FIREBASE_STORAGE_BUCKET ?? "").trim();
  if (!bucketName) return null;

  const bucket = admin.storage().bucket(bucketName);
  const file = bucket.file(path);

  // optional: verhindert Fehler, wenn path falsch ist
  const [exists] = await file.exists();
  if (!exists) return null;

  // 7 Tage gültig
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const [url] = await file.getSignedUrl({ action: "read", expires });
  return url;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();
    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    const tq = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tq.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tastingDoc = tq.docs[0];
    const tData = tastingDoc.data() as any;

    const wineCount = num(tData.wineCount, 0);
    const status = String(tData.status ?? "open");

    const winesSnap = await tastingDoc.ref.collection("wines").get();

    const wines = await Promise.all(
      winesSnap.docs.map(async (d) => {
        const w = d.data() as any;

        const blindNumber = Number.isFinite(Number(w.blindNumber)) ? Number(w.blindNumber) : null;

        const imagePath = str(w.imagePath);
        let imageUrl = str(w.imageUrl);

        // ✅ wenn imageUrl fehlt, aber imagePath da ist -> URL erzeugen
        if (!imageUrl && imagePath) {
          imageUrl = await signedUrlForPath(imagePath);
        }

        return {
          id: d.id,
          blindNumber,
          serveOrder: Number.isFinite(Number(w.serveOrder)) ? Number(w.serveOrder) : null,
          ownerName: str(w.ownerName),
          winery: str(w.winery),
          grape: str(w.grape),
          vintage: str(w.vintage),
          imageUrl,
          imagePath,
        };
      })
    );

    wines.sort((a, b) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999));

    return NextResponse.json(
      {
        ok: true,
        publicSlug,
        tastingId: tastingDoc.id,
        status,
        wineCount,
        wines,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
