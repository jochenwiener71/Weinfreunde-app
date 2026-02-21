import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/firebaseAdmin";

type JoinBody = {
  slug: string;
  name: string;
  pin: string;
};

function verifyPin(pin: string, storedHashRaw: string) {
  const salt = process.env.PIN_SALT ?? "";

  const storedHash = String(storedHashRaw ?? "").trim().toLowerCase();

  // Guard: storedHash muss ein gültiger SHA256 Hex-String sein (64 chars)
  if (!/^[0-9a-f]{64}$/.test(storedHash)) return false;

  const computed = crypto
    .createHash("sha256")
    .update(`${pin}:${salt}`)
    .digest("hex");

  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHash, "hex");

  // Muss gleich lang sein, sonst timingSafeEqual wirft
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<JoinBody>;

    const slugRaw = String(body?.slug ?? "").trim();
    const nameRaw = String(body?.name ?? "").trim();
    const pinRaw = String(body?.pin ?? "").trim();

    if (!slugRaw || !nameRaw || !pinRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing slug/name/pin" },
        { status: 400 }
      );
    }

    const slug = slugRaw.toLowerCase();
    const name = nameRaw;
    const pin = pinRaw;

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, error: "Invalid PIN format" },
        { status: 400 }
      );
    }

    // 🔎 1) Suche über publicSlug
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
      // 🔎 2) Fallback: slug als DocId
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

    const pinValid = verifyPin(pin, tastingData.pinHash);

    if (!pinValid) {
      return NextResponse.json(
        { ok: false, error: "Invalid PIN" },
        { status: 403 }
      );
    }

    // 👤 Participant anlegen
    const participantRef = await db()
      .collection("tastings")
      .doc(tastingDoc.id)
      .collection("participants")
      .add({
        name,
        createdAt: new Date(),
      });

    const res = NextResponse.json({ ok: true });

    // 🍪 Session Cookie setzen
    res.cookies.set(
      "weinfreunde_session",
      JSON.stringify({
        tastingId: tastingDoc.id,
        participantId: participantRef.id,
        participantName: name,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      }
    );

    return res;
  } catch (err) {
    console.error("[JOIN ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
