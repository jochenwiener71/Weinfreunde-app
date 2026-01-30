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
  const t = doc.data();

  const [criteriaSnap, winesSnap] = await Promise.all([
    doc.ref.collection("criteria").orderBy("order").get(),
    doc.ref.collection("wines").orderBy("blindNumber").get(),
  ]);

  return NextResponse.json({
    tasting: {
      title: t.title,
      hostName: t.hostName,
      status: t.status,
    },
    criteria: criteriaSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    wines: winesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  });
}
