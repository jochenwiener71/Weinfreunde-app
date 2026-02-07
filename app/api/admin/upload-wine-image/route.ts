import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";
import admin from "firebase-admin";

export const runtime = "nodejs";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();
    const wineId = String(searchParams.get("wineId") ?? "").trim();

    if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    if (!wineId) return NextResponse.json({ error: "Missing wineId" }, { status: 400 });

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const blob = file as Blob;
    const contentType = (blob as any).type || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Only images allowed" }, { status: 400 });
    }

    // 1) resolve tasting doc by publicSlug
    const snap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (snap.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

    const tastingDoc = snap.docs[0];
    const tastingId = tastingDoc.id;

    // 2) storage bucket
    const bucketName = String(process.env.FIREBASE_STORAGE_BUCKET ?? "").trim();
    if (!bucketName) {
      return NextResponse.json({ error: "Missing FIREBASE_STORAGE_BUCKET env var" }, { status: 500 });
    }

    const bucket = admin.storage().bucket(bucketName);

    // 3) upload path
    const ext = contentType.includes("png") ? "png" : "jpg";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const originalName = sanitizeFilename((file as any).name || `bottle.${ext}`);

    const imagePath = `tastings/${tastingId}/wines/${wineId}/bottle_${ts}_${originalName}`;

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const gcsFile = bucket.file(imagePath);

    await gcsFile.save(buffer, {
      resumable: false,
      contentType,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    // 4) signed URL (10 years)
    const expires = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
    const [imageUrl] = await gcsFile.getSignedUrl({
      action: "read",
      expires,
    });

    // ✅ 5) IMPORTANT: persist imageUrl + imagePath in Firestore wine doc
    const wineRef = tastingDoc.ref.collection("wines").doc(wineId);

    await wineRef.set(
      {
        imageUrl,
        imagePath,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, tastingId, wineId, imageUrl, imagePath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
