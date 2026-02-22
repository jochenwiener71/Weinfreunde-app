// app/api/session/resume/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

type Body = {
  slug: string;
  name: string;
  pin: string;
};

function normalizeNameKey(name: string) {
  return name.trim().toLowerCase();
}

function verifyPin(pin: string, storedHash: string) {
  const salt = process.env.PIN_SALT ?? "";
  const computed = crypto.createHash("sha256").update(`${pin}:${salt}`).digest("hex");

  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function getTastingBySlug(slug: string) {
  const q = await db().collection("tastings").where("publicSlug", "==", slug).limit(1).get();
  if (!q.empty) return q.docs[0];
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const slug = String(body?.slug ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim();
    const pin = String(body?.pin ?? "").trim();

    if (!slug || !name || !pin) {
      return NextResponse.json({ ok: false, error: "Missing slug/name/pin" }, { status: 400 });
    }
    if (pin.length !== 4) {
      return NextResponse.json({ ok: false, error: "Invalid PIN format" }, { status: 400 });
    }

    const tastingDoc = await getTastingBySlug(slug);
    if (!tastingDoc) return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });

    const tasting = tastingDoc.data() as any;
    if (!tasting?.pinHash) {
      return NextResponse.json({ ok: false, error: "Tasting PIN not configured" }, { status: 500 });
    }

    // ✅ PIN gegen Tasting pinHash prüfen (nicht gegen Participant)
    const pinValid = verifyPin(pin, String(tasting.pinHash));
    if (!pinValid) {
      return NextResponse.json({ ok: false, error: "PIN falsch" }, { status: 401 });
    }

    const participantsRef = tastingDoc.ref.collection("participants");
    const nameKey = normalizeNameKey(name);

    // ✅ Participant wiederfinden (nameKey bevorzugt)
    let participantDoc: admin.firestore.QueryDocumentSnapshot | null = null;

    const q1 = await participantsRef.where("nameKey", "==", nameKey).limit(1).get();
    if (!q1.empty) participantDoc = q1.docs[0];

    if (!participantDoc) {
      const q2 = await participantsRef.where("name", "==", name).limit(1).get();
      if (!q2.empty) participantDoc = q2.docs[0];
    }

    if (!participantDoc) {
      return NextResponse.json({ ok: false, error: "Teilnehmer nicht gefunden" }, { status: 404 });
    }

    // nameKey nachziehen, falls fehlte
    await participantsRef.doc(participantDoc.id).set(
      { nameKey, updatedAt: admin.firestore.FieldValue.serverTimestamp(), isActive: true },
      { merge: true }
    );

    const p = participantDoc.data() as any;

    const res = NextResponse.json({ ok: true });

    setSessionCookie(res, {
      tastingId: tastingDoc.id,
      participantId: participantDoc.id,
      participantName: String(p?.name ?? name),
      publicSlug: slug,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Resume failed" }, { status: 500 });
  }
}
