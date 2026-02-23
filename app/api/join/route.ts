import { NextResponse } from "next/server";
import admin from "firebase-admin";
import crypto from "crypto";
import { db } from "@/lib/firebaseAdmin";
import { setSessionCookie, requireSessionOptional } from "@/lib/session";

function verifyPin(pin: string, storedHash: string) {
  const salt = process.env.PIN_SALT ?? "";
  const computed = crypto
    .createHash("sha256")
    .update(`${pin}:${salt}`)
    .digest("hex");

  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const pin = String(body.pin ?? "").trim();

    if (!slug || !name || !pin) {
      return NextResponse.json(
        { ok: false, error: "Missing slug/name/pin" },
        { status: 400 }
      );
    }

    if (pin.length !== 4) {
      return NextResponse.json(
        { ok: false, error: "Invalid PIN format" },
        { status: 400 }
      );
    }

    const q = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    if (q.empty) {
      return NextResponse.json(
        { ok: false, error: "Tasting not found" },
        { status: 404 }
      );
    }

    const tastingDoc = q.docs[0];
    const tasting = tastingDoc.data() as any;

    if (!tasting?.pinHash) {
      return NextResponse.json(
        { ok: false, error: "Tasting PIN not configured" },
        { status: 500 }
      );
    }

    if (!verifyPin(pin, tasting.pinHash)) {
      return NextResponse.json(
        { ok: false, error: "Invalid PIN" },
        { status: 403 }
      );
    }

    // 🔁 Wenn Session schon existiert → kein neuer Nutzer
    const existingSession = requireSessionOptional();
    if (existingSession?.participantId) {
      return NextResponse.json({
        ok: true,
        resumed: true,
        participantId: existingSession.participantId,
      });
    }

    // ➕ neuen Participant anlegen
    const participantRef = tastingDoc.ref.collection("participants").doc();
    await participantRef.set({
      name,
      nameNorm: name.toLowerCase(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const res = NextResponse.json({
      ok: true,
      participantId: participantRef.id,
    });

    setSessionCookie(res, {
      participantId: participantRef.id,
      slug,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Join failed" },
      { status: 500 }
    );
  }
}
