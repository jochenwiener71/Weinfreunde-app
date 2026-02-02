import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET() {
  try {
    // erzwingt Firebase Admin Init + echten Firestore Read
    const snap = await db().collection("_health").limit(1).get();

    return NextResponse.json({
      ok: true,
      message: "firebase admin init + firestore read OK",
      docs: snap.size,
      hasB64: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64),
      b64Len: String(process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "").trim().length,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "firebase init failed",
        error: e?.message ?? String(e),
        hasB64: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64),
        b64Len: String(process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "").trim().length,
      },
      { status: 500 }
    );
  }
}
