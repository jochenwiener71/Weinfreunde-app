import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const q = await db()
    .collection("tastings")
    .where("publicSlug", "==", slug)
    .limit(1)
    .get();

  if (q.empty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = q.docs[0];
  const ratingsSnap = await doc.ref.collection("ratings").get();

  return NextResponse.json({
    count: ratingsSnap.size,
  });
}
