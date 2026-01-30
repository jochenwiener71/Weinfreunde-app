import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { hashPin } from "@/lib/security";

type CriterionInput = {
  label: string;
  scaleMin?: number;
  scaleMax?: number;
};

export async function POST(req: Request) {
  try {
    // Simple admin auth via header secret
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
    const status = String(body.status ?? "open"); // draft|open|closed|revealed

    const criteriaIn: CriterionInput[] = Array.isArray(body.criteria) ? body.criteria : [];

    if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
    if (!hostName) return NextResponse.json({ error: "Missing hostName" }, { status: 400 });
    if (!/^\d{4}$/.test(pin)) return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });

    if (!Number.isInteger(wineCount) || wineCount < 1 || wineCount > 10) {
      return NextResponse.json({ error: "wineCount must be 1..10" }, { status: 400 });
    }
    if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 10) {
      return NextResponse.json({ error: "maxParticipants must be 1..10" }, { status: 400 });
    }

    if (criteriaIn.length < 1) {
      return NextResponse.json({ error: "Provide at least 1 criterion" }, { status: 400 });
    }
    if (criteriaIn.length > 8) {
      return NextResponse.json({ error: "Max 8 criteria" }, { status: 400 });
    }

    // Ensure slug unique
    const existing = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: "publicSlug already exists" }, { status: 409 });
    }

    const pinHash = hashPin(pin);

    const tastingRef = db().collection("tastings").doc();
    const tastingId = tastingRef.id;

    const batch = db().batch();

    batch.set(tastingRef, {
      publicSlug,
      title,
      hostName,
      status,
      pinHash,
      maxParticipants,
      wineCount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create criteria
    criteriaIn.forEach((c, idx) => {
      const label = String(c.label ?? "").trim();
      if (!label) return;

      const scaleMin = Number.isFinite(c.scaleMin) ? Number(c.scaleMin) : 1;
      const scaleMax = Number.isFinite(c.scaleMax) ? Number(c.scaleMax) : 10;

      const critRef = tastingRef.collection("criteria").doc();
      batch.set(critRef, {
        label,
        scaleMin,
        scaleMax,
        order: idx + 1,
      });
    });

    // Create wines 1..wineCount
    for (let n = 1; n <= wineCount; n++) {
      const wRef = tastingRef.collection("wines").doc();
      batch.set(wRef, {
        blindNumber: n,
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json({
      ok: true,
      tastingId,
      publicSlug,
      status,
      wineCount,
      maxParticipants,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Create tasting failed" }, { status: 500 });
  }
}
