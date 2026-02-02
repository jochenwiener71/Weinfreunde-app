import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

function safeFileExt(mime: string, fallback = "jpg") {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  return fallback;
}

function nowIsoCompact() {
  // 2026-02-02T21:03:55.123Z -> 20260202T210355123Z
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\./g, "");
}

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const bucketName = String(process.env.FIREBASE_STORAGE_BUCKET ?? "").trim();
    if (!bucketName) {
      return NextResponse.json(
        { error: "Missing FIREBASE_STORAGE_BUCKET env var" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const publicSlug = String(form.get("publicSlug") ?? "").trim();
    const wineId = String(form.get("wineId") ?? "").trim();
    const file = form.get("file");

    if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    if (!wineId) return NextResponse.json({ error: "Missing wineId" }, { status: 400 });
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // Find tasting by publicSlug
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

    // Verify wine exists
    const wineRef = db().collection("tastings").doc(tastingId).collection("wines").doc(wineId);
    const wineSnap = await wineRef.get();
    if (!wineSnap.exists) {
      return NextResponse.json({ error: "Wine not found" }, { status: 404 });
    }

    const mime = (file as any).type ? String((file as any).type) : "image/jpeg";
    const ext = safeFileExt(mime, "jpg");

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Storage path
    const imagePath = `tastings/${tastingId}/wines/${wineId}/bottle_${nowIsoCompact()}.${ext}`;

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket(bucketName);
    const gcsFile = bucket.file(imagePath);

    // Important: make it public via signed URL OR via public ACL.
    // We’ll use signed URL (works without “public” bucket rules).
    await gcsFile.save(buffer, {
      contentType: mime,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    // Signed URL (long-lived)
    const [signedUrl] = await gcsFile.getSignedUrl({
      action: "read",
      expires: "2099-01-01",
    });

    const imageUrl = signedUrl;

    // Persist into Firestore
    await wineRef.set(
      {
        imageUrl,
        imagePath,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId,
      wineId,
      imagePath,
      imageUrl,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
