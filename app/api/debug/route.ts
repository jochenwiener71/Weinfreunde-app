import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const snap = await db().collection("tastings").limit(5).get();

  return NextResponse.json({
    project: process.env.FIREBASE_PROJECT_ID,
    tastingsCount: snap.size,
    tastings: snap.docs.map(d => d.data()),
  });
}
