import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

function pickExt(contentType: string | null, fallbackName?: string | null) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";

  const name = (fallbackName || "").toLowerCase();
  const m = name.match(/\.(png|webp|jpg|jpeg)$/);
  if (m?.[1]) return m[1] === "jpeg" ? "jpg" : m[1];

  return "jpg";
}

function randomToken() {
  // download token used by Firebase Storage "alt=media&token=..."
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-]/g, "");
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const bucketName = String(process.env.FIREBASE_STORAGE_BUCKET ?? "").trim();
    if (!bucketName) {
      return NextResponse.json({ error: "Missing FIREBASE_STORAGE_BUCKET env var" }, { status: 500 });
    }

    const form = await req.formData();

    const publicSlug = String(form.get("publicSlug") ?? "").trim();
    const wineId = String(form.get("wineId") ?? "").trim();
    const file = form.get("file");

    if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    if (!wineId) return NextResponse.json({ error: "Missing wineId" }, { status: 400 });
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // Ensure Firebase Admin is initialized (your db() does init internally)
    db();

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

    // Validate wine doc exists
    const wineRef = tDoc.ref.collection("wines").doc(wineId);
    const wineSnap = await wineRef.get();
    if (!wineSnap.exists) {
      return NextResponse.json({ error: "Wine not found" }, { status: 404 });
    }

    // Read file buffer
    const blob = file as Blob;
    const ab = await blob.arrayBuffer();
    const buf = Buffer.from(ab);

    const contentType = (blob as any)?.type ? String((blob as any).type) : "image/jpeg";
    const ext = pickExt(contentType, (file as any)?.name ?? null);

    const objectPath = `wines/${tastingId}/${wineId}.${ext}`;

    // Upload to Firebase Storage via Admin SDK
    const bucket = admin.storage().bucket(bucketName);
    const gcsFile = bucket.file(objectPath);

    const token = randomToken();

    await gcsFile.save(buf, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000",
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    // Build Firebase-style download URL
    const encodedPath = encodeURIComponent(objectPath);
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

    // Persist URL on the wine document
    await wineRef.set(
      {
        imageUrl,
        imagePath: objectPath,
        imageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId,
      wineId,
      imageUrl,
      imagePath: objectPath,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
