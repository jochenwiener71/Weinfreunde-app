import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET() {
  try {
    // erzwingt Firebase-Init + echten Firestore Read
    const snap = await db().collection("_health").limit(1).get();

    const bucketFromEnv =
      process.env.FIREBASE_STORAGE_BUCKET ??
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
      null;

    // Firebase Admin nutzt optional FIREBASE_STORAGE_BUCKET über initializeApp({ storageBucket })
    // Wir prüfen hier erstmal nur, ob die ENV ankommt.
    // (Der echte Upload-Test kommt später über eine Upload-Route.)
    return NextResponse.json({
      ok: true,
      message: "firebase admin + firestore OK",
      env: {
        hasServiceAccountB64: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64),
        hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
        hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
        hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),

        // Storage:
        hasStorageBucket: Boolean(bucketFromEnv),
        storageBucket: bucketFromEnv, // zeigt dir den konkreten Wert, der in Vercel ankommt
      },
      firestore: {
        readOk: true,
        docs: snap.size,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "firebase init failed",
        error: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
