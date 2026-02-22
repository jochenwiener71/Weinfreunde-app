// app/api/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/firebase-admin";
import { setSessionCookie } from "@/lib/session";

type JoinBody = {
  slug: string;
  name: string;
  pin: string;
};

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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as JoinBody;

    if (!body?.slug || !body?.name || !body?.pin) {
      return NextResponse.json(
        { ok: false, error: "Missing slug/name/pin" },
        { status: 400 }
      );
    }

    const slug = body.slug.trim().toLowerCase();
    const name = body.name.trim();
    const pin = body.pin.trim();

    if (pin.length !== 4) {
      return NextResponse.json(
        { ok: false, error: "Invalid PIN format" },
        { status: 400 }
      );
    }

    // 🔎 1) Lookup by publicSlug
    const query = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    let tastingDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null =
      null;

    if (!query.empty) {
      tastingDoc = query.docs[0];
    } else {
      // 🔎 2) Fallback: slug as DocId
      const doc = await db().collection("tastings").doc(slug).get();
      if (doc.exists) tastingDoc = doc;
    }

    if (!tastingDoc) {
      return NextResponse.json(
        { ok: false, error: "Tasting not found" },
        { status: 404 }
      );
    }

    const tastingData = tastingDoc.data() as any;

    if (!tastingData?.pinHash) {
      return NextResponse.json(
        { ok: false, error: "Tasting PIN not configured" },
        { status: 500 }
      );
    }

    const pinValid = verifyPin(pin, String(tastingData.pinHash));
    if (!pinValid) {
      return NextResponse.json(
        { ok: false, error: "Invalid PIN" },
        { status: 403 }
      );
    }

    // 🍷 Participant anlegen
    const participantRef = await db()
      .collection("tastings")
      .doc(tastingDoc.id)
      .collection("participants")
      .add({
        name,
        createdAt: new Date(),
      });

    const res = NextResponse.json({ ok: true });

    // ✅ Session-Cookie (SIGNED) setzen -> kompatibel zu requireSession()
    setSessionCookie(res, {
      tastingId: tastingDoc.id,
      participantId: participantRef.id,
      participantName: name,
      publicSlug: slug,
    });

    return res;
  } catch (err) {
    console.error("[JOIN ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
