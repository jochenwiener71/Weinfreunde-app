import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET() {
  try {
    // erzwingt Firebase-Init + echten Firestore Read
    const snap = await db().collection("_health").limit(1).get();

    return NextResponse.json({
      ok: true,
      message: "firebase admin + firestore OK",
      env: {
        hasServiceAccountB64: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64),
        hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
        hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
        hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
      },
      firestore: {
        readOk: true,
        docs: snap.size,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: "firebase init failed", error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
