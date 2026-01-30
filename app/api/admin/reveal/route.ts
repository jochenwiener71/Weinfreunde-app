import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "../../../../lib/firebaseAdmin";

function pickProvidedSecret(req: Request, body: any): string {
  const header =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  if (header && header.trim()) return header.trim();

  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  const fromBody =
    body?.adminSecret ??
    body?.ADMIN_SECRET ??
    body?.admin_secret ??
    body?.secret ??
    "";

  return String(fromBody ?? "").trim();
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
    return NextResponse.json(
      { error: "Server misconfigured: ADMIN_SECRET missing" },
      { status: 500 }
    );
  }

  const provided = pickProvidedSecret(req, body);
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const publicSlug = String(body.publicSlug ?? "").trim();
  const tastingId = String(body.tastingId ?? "").trim();

  if (!publicSlug && !tastingId) {
    return NextResponse.json(
      { error: "Provide either publicSlug or tastingId" },
      { status: 400 }
    );
  }

  try {
    // Tasting finden
    let tRef: FirebaseFirestore.DocumentReference | null = null;

    if (tastingId) {
      tRef = db().collection("tastings").doc(tastingId);
      const snap = await tRef.get();
      if (!snap.exists) {
        return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
      }
    } else {
      const q = await db()
        .collection("tastings")
        .where("publicSlug", "==", publicSlug)
        .limit(1)
        .get();

      if (q.empty) {
        return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
      }
      tRef = q.docs[0].ref;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    await tRef!.set(
      {
        status: "revealed",
        revealedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    const tSnap = await tRef!.get();
    const data = tSnap.data() || {};

    return NextResponse.json({
      ok: true,
      tastingId: tRef!.id,
      publicSlug: data.publicSlug ?? publicSlug ?? null,
      status: "revealed",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Reveal failed" },
      { status: 500 }
    );
  }
}
