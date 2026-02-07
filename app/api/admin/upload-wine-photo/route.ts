import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

function safeStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

export const runtime = "nodejs"; // wichtig für firebase-admin + storage

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const form = await req.formData();

    const publicSlug = safeStr(form.get("publicSlug"));
    const wineId = safeStr(form.get("wineId"));
    const file = form.get("file");

    if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    if (!wineId) return NextResponse.json({ error: "Missing wineId" }, { status: 400 });
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // 1) tasting by publicSlug
    const snap = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
    if (snap.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

    const tastingDoc = snap.docs[0];
    const tastingId = tastingDoc.id;

    // 2) upload to Firebase Storage
    const bucket = admin.storage().bucket(); // nutzt storageBucket aus firebaseAdmin.ts

    const ts = new Date().toISOString().replace(/[:.]/g, "");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `tastings/${tastingId}/wines/${wineId}/bottle_${ts}.${ext}`;

    const bytes = Buffer.from(await file.arrayBuffer());

    const storageFile = bucket.file(path);
    await storageFile.save(bytes, {
      resumable: false,
      contentType: file.type || "image/jpeg",
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // 3) create long-lived read URL (Signed URL)
    const [imageUrl] = await storageFile.getSignedUrl({
      action: "read",
      expires: "2500-01-01",
    });

    // 4) persist in Firestore wine doc
    await tastingDoc.ref.collection("wines").doc(wineId).set(
      {
        imagePath: path,
        imageUrl: imageUrl || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      tastingId,
      wineId,
      imagePath: path,
      imageUrl: imageUrl || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 500 });
  }
}
