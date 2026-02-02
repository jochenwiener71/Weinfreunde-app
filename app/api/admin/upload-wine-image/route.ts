import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

function extFromMime(mime: string) {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "jpg"; // default for jpeg/jpg/unknown images
}

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const form = await req.formData();

    const publicSlug = String(form.get("publicSlug") ?? "").trim();
    const wineId = String(form.get("wineId") ?? "").trim();
    const file = form.get("file");

    if (!publicSlug || !wineId) {
      return NextResponse.json({ error: "Missing publicSlug or wineId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // find tasting
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

    // upload to Firebase Storage
    const bucket = admin.storage().bucket(); // uses FIREBASE_STORAGE_BUCKET from init()
    const mime = file.type || "image/jpeg";
    const ext = extFromMime(mime);

    const objectPath = `tastings/${tastingId}/wines/${wineId}/bottle.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const gcsFile = bucket.file(objectPath);

    await gcsFile.save(buf, {
      contentType: mime,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000", // 1 year cache
      },
    });

    // create a long-lived signed READ url (no public bucket required)
    const [signedUrl] = await gcsFile.getSignedUrl({
      action: "read",
      // pick a far future date
      expires: "2036-01-01",
    });

    // store URL on the wine doc
    await tDoc.ref
      .collection("wines")
      .doc(wineId)
      .set(
        {
          imageUrl: signedUrl,
          imagePath: objectPath,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, imageUrl: signedUrl, imagePath: objectPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 500 });
  }
}
