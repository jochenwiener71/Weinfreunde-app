import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "../../../../lib/firebaseAdmin";
import { hashPin } from "../../../../lib/security";

type CriterionInput = {
  label: string;
  scaleMin?: number;
  scaleMax?: number;
};

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-admin-secret") ?? "";
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const publicSlug = String(body.publicSlug ?? "").trim();
    const title = String(body.title ?? "").trim();
    const hostName = String(body.hostName ?? "").trim();
    const pin = String(body.pin ?? "").trim();

    const wineCount = Number(body.wineCount ?? 10);
    const maxParticipants = Number(body.maxParticipants ?? 10);
    const status = String(body.status ?? "open");
    const criteriaIn: CriterionInput[] = Array.isArray(body.criteria) ? body.criteria : [];

    if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
    if (!hostName) return NextResponse.json({ error: "Missing hostName" }, { status: 400 });
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
    }

    if (wineCount < 1 || wineCount > 10) {
      return NextResponse.json({ error: "wineCount must be 1..10" }, { status: 400 });
    }
    if (maxParticipants < 1 || maxParticipants > 10) {
      return NextResponse.json({ error: "maxParticipants must be 1..10" }, { status: 400 });
    }
    if (criteriaIn.length < 1 || criteriaIn.length > 8) {
      return NextResponse.json({ error: "criteria must be 1..8 items" }, { status: 400 });
    }

    const existing = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ error: "publicSlug already exists" }, { status: 409 });
    }

    const pinHash = hashPin(pin);

    const tastingRef = db().collection("tastings").doc();
    const batch = db().batch();

    batch.set(tastingRef, {
      publicSlug,
      title,
      hostName,
      status,
      pinHash,
      wineCount,
      maxParticipants,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    criteriaIn.forEach((c, idx) => {
      const ref = tastingRef.collection("criteria").doc();
      batch.set(ref, {
        label: c.label,
        scaleMin: c.scaleMin ?? 1,
        scaleMax: c.scaleMax ?? 10,
        order: idx + 1,
      });
    });

    for (let i = 1; i <= wineCount; i++) {
      const ref = tastingRef.collection("wines").doc();
      batch.set(ref, {
        blindNumber: i,
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json({
      ok: true,
      tastingId: tastingRef.id,
      publicSlug,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Create failed" }, { status: 500 });
  }
}
