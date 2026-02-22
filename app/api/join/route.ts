// app/api/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { getSession, setSessionCookie } from "@/lib/session";

type JoinBody = {
  slug: string;
  name: string;
  pin: string;
};

export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as JoinBody;

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
    if (!tastingDoc) {
      return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });
    }

    const tasting = tastingDoc.data() as any;

    if (!tasting?.pinHash) {
      return NextResponse.json({ ok: false, error: "Tasting PIN not configured" }, { status: 500 });
    }

    // ✅ Wenn bereits eingeloggt und Session gehört zu diesem Tasting → kein neuer Participant
    const existingSession = getSession();
    if (existingSession?.tastingId === tastingDoc.id) {
      return NextResponse.json({ ok: true, reused: true, alreadyLoggedIn: true });
    }

    // ✅ PIN validieren (Tasting-PIN)
    const pinValid = verifyPin(pin, String(tasting.pinHash));
    if (!pinValid) {
      return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 403 });
    }

    // ✅ Participant wiederverwenden statt immer add()
    const nameKey = normalizeNameKey(name);

    const participantsRef = tastingDoc.ref.collection("participants");

    let participantId: string | null = null;
    let participantName: string = name;

    // 1) Suche nach nameKey
    const pq = await participantsRef.where("nameKey", "==", nameKey).limit(1).get();
    if (!pq.empty) {
      participantId = pq.docs[0].id;
      const p = pq.docs[0].data() as any;
      participantName = String(p?.name ?? name);
    } else {
      // 2) Fallback: Suche nach name (falls ältere Daten ohne nameKey)
      const pq2 = await participantsRef.where("name", "==", name).limit(1).get();
      if (!pq2.empty) {
        participantId = pq2.docs[0].id;
        const p = pq2.docs[0].data() as any;
        participantName = String(p?.name ?? name);

        // nameKey nachziehen
        await participantsRef.doc(participantId).set(
          { nameKey, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      } else {
        // 3) Neu anlegen
        const created = await participantsRef.add({
          name,
          nameKey,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: true,
        });
        participantId = created.id;
      }
    }

    // ✅ Session Cookie setzen (wf_session)
    const res = NextResponse.json({ ok: true, participantId, reused: pq.empty ? false : true });

    setSessionCookie(res, {
      tastingId: tastingDoc.id,
      participantId: String(participantId),
      participantName,
      publicSlug: slug,
    });

    return res;
  } catch (err) {
    console.error("[JOIN ERROR]", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
