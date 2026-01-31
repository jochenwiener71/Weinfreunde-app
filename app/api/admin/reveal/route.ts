import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

function getProvidedSecret(req: Request, body: any) {
  const h =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  if (h && h.trim()) return h.trim();

  const fromBody = String(body?.adminSecret ?? "").trim();
  return fromBody;
}

async function findTasting(bodyOrQuery: { tastingId?: string; publicSlug?: string }) {
  const tastingId = String(bodyOrQuery.tastingId ?? "").trim();
  const publicSlug = String(bodyOrQuery.publicSlug ?? "").trim();

  if (tastingId) {
    const ref = db().collection("tastings").doc(tastingId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    return { ref, id: snap.id, data: snap.data() };
  }

  if (publicSlug) {
    const q = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
    if (q.empty) return null;
    return { ref: q.docs[0].ref, id: q.docs[0].id, data: q.docs[0].data() };
  }

  return null;
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_SECRET is not set in this deployment." }, { status: 500 });
  }

  const provided = getProvidedSecret(req, body);
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = String(body?.status ?? "revealed").trim(); // open | revealed | closed | draft

  const found = await findTasting({ tastingId: body?.tastingId, publicSlug: body?.publicSlug });
  if (!found) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

  await found.ref.update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, tastingId: found.id, status });
}

// Optional GET for convenience: /api/admin/reveal?publicSlug=...&status=revealed
export async function GET(req: Request) {
  const url = new URL(req.url);
  const publicSlug = String(url.searchParams.get("publicSlug") ?? "").trim();
  const tastingId = String(url.searchParams.get("tastingId") ?? "").trim();
  const status = String(url.searchParams.get("status") ?? "revealed").trim();

  // Secret via header only on GET (safer than query)
  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  const provided =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  if (!expected) return NextResponse.json({ error: "ADMIN_SECRET is not set in this deployment." }, { status: 500 });
  if (!provided || provided.trim() !== expected) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const found = await findTasting({ tastingId, publicSlug });
  if (!found) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

  await found.ref.update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, tastingId: found.id, status });
}
