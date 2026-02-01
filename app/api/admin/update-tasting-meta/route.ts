import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

function requireAdminSecret(req: Request) {
  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  const provided = req.headers.get("x-admin-secret") || req.headers.get("X-Admin-Secret") || "";
  if (!expected) throw new Error("ADMIN_SECRET is not set in this deployment.");
  if (!provided || String(provided).trim() !== expected) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    requireAdminSecret(req);

    const body = await req.json().catch(() => ({}));
    const publicSlug = String(body?.publicSlug ?? "").trim();
    if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });

    const q = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
    if (q.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

    const ref = q.docs[0].ref;

    const title = String(body?.title ?? "").trim();
    const hostName = String(body?.hostName ?? "").trim();
    const tastingDate = String(body?.tastingDate ?? "").trim(); // "YYYY-MM-DD" (optional)
    const maxParticipants = Number(body?.maxParticipants ?? NaN);

    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
    if (!hostName) return NextResponse.json({ error: "Missing hostName" }, { status: 400 });
    if (!Number.isFinite(maxParticipants) || maxParticipants < 1 || maxParticipants > 50) {
      return NextResponse.json({ error: "Invalid maxParticipants" }, { status: 400 });
    }
    if (tastingDate && !/^\d{4}-\d{2}-\d{2}$/.test(tastingDate)) {
      return NextResponse.json({ error: "tastingDate must be YYYY-MM-DD" }, { status: 400 });
    }

    await ref.update({
      title,
      hostName,
      tastingDate: tastingDate || "",
      maxParticipants,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status ?? 500);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status });
  }
}
