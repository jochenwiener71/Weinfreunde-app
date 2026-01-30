import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "../../../../lib/firebaseAdmin";
import { hashPin } from "../../../../lib/security";

type CriterionInput = { label: string; scaleMin: number; scaleMax: number };

function getAdminSecret(req: Request, body: any): string {
  // 1) Header (empfohlen)
  const h =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    req.headers.get("x-admin_secret") ||
    req.headers.get("x-adminsecret") ||
    "";

  if (h && h.trim()) return h.trim();

  // 2) Authorization: Bearer <secret>
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  // 3) Body-Felder (falls UI es dort mitschickt)
  const b =
    body?.adminSecret ??
    body?.ADMIN_SECRET ??
    body?.admin_secret ??
    body?.secret ??
    "";

  return String(b).trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const provided = getAdminSecret(req, body);
    const expected = (process.env.ADMIN_SECRET ?? "").trim();

    if (!expected || !provided || provided !== expected) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const publicSlug = String(body.publicSlug ?? "").trim();
    const title = String(body.title ?? "").trim();
    const hostName = String(body.hostName ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    const status = String(body.status ?? "open").trim();
    const wineCount = Number(body.wineCount ?? 10);
    const maxParticipants = Number(body.maxParticipants ?? 10);
    const criteria = (body.criteria ?? []) as CriterionInput[];

    if (!publicSlug || !title || !hostName || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (!Number.isInteger(wineCount) || wineCount < 1 || wineCount > 10) {
      return NextResponse.json({ error: "Invalid wineCount" }, { status: 400 });
    }
    if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 10) {
      return NextResponse.json({ error: "Invalid maxParticipants" }, { status: 400 });
    }
    if (!Array.isArray(criteria) || criteria.length < 1 || criteria.length > 8) {
      return NextResponse.json({ error: "Invalid criteria" }, { status: 400 });
    }

    // Slug uniqueness check
    const existing = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ error: "publicSlug already exists" }, { status: 409 });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const pinHash = hashPin(pin);

    const tRef = db().collection("tastings").doc();
    const batch = db().batch();

    batch.set(tRef, {
      publicSlug,
      title,
      hostName,
      status,
      wineCount,
      maxParticipants,
      pinHash,
      createdAt: now,
      updatedAt: now,
    });

    // criteria subcollection
    criteria.forEach((c, idx) => {
      const ref = tRef.collection("criteria").doc();
      batch.set(ref, {
        label: String(c.label ?? "").trim(),
        scaleMin: Number(c.scaleMin ?? 1),
        scaleMax: Number(c.scaleMax ?? 10),
        order: idx,
        createdAt: now,
        updatedAt: now,
      });
    });

    // wines subcollection (blind slots)
    for (let i = 1; i <= wineCount; i++) {
      const ref = tRef.collection("wines").doc();
      batch.set(ref, {
        blindNumber: i,
        isActive: true,
        // revealed fields later:
        displayName: null,
        winery: null,
        grape: null,
        vintage: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();

    return NextResponse.json({ ok: true, tastingId: tRef.id, publicSlug });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Create tasting failed" }, { status: 500 });
  }
}
