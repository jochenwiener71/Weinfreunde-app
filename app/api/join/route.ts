// app/api/join/route.ts
import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { verifyPin } from "@/lib/security";
import { createSession } from "@/lib/session";

function isActiveParticipant(p: any): boolean {
  // ✅ backward compatible:
  // - isActive fehlt => gilt als aktiv
  // - isActive === false => inaktiv
  if (typeof p?.isActive === "boolean") return p.isActive;
  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const slug = String(body.slug ?? "").trim();
    const pin = String(body.pin ?? "").trim();

    // ✅ wir akzeptieren sowohl "alias" als auch "name" aus dem Client
    const alias = String(body.alias ?? "").trim();
    const name = String(body.name ?? "").trim();
    const displayName = (name || alias).trim();

    if (!slug || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // 1) tasting by publicSlug
    const q = await db()
      .collection("tastings")
      .where("publicSlug", "==", slug)
      .limit(1)
      .get();

    if (q.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tastingDoc = q.docs[0];
    const tastingRef = tastingDoc.ref;

    // 2) Join als Transaction (verhindert Race Conditions)
    const result = await db().runTransaction(async (tx) => {
      const tSnap = await tx.get(tastingRef);
      if (!tSnap.exists) throw new Error("Tasting not found");

      const tasting = tSnap.data() as any;

      if (String(tasting.status ?? "") !== "open") {
        // nicht open -> kein join
        const err: any = new Error("Tasting not open");
        err.status = 403;
        throw err;
      }

      if (!verifyPin(pin, tasting.pinHash)) {
        const err: any = new Error("Invalid PIN");
        err.status = 401;
        throw err;
      }

      const maxParticipants =
        typeof tasting.maxParticipants === "number" && tasting.maxParticipants > 0
          ? tasting.maxParticipants
          : 10;

      const participantsRef = tastingRef.collection("participants");

      // ✅ wir lesen alle participant docs (bei euch: max ~10) und zählen nur aktive
      const pSnap = await tx.get(participantsRef.limit(200));
      const activeCount = pSnap.docs.reduce((acc, d) => {
        const p = d.data() as any;
        return acc + (isActiveParticipant(p) ? 1 : 0);
      }, 0);

      if (activeCount >= maxParticipants) {
        const err: any = new Error("Tasting full");
        err.status = 409;
        throw err;
      }

      // ✅ neuen Teilnehmer anlegen
      const pRef = participantsRef.doc();
      tx.set(pRef, {
        // wir speichern beides für Kompatibilität
        alias: displayName || `Teilnehmer ${activeCount + 1}`,
        name: displayName || `Teilnehmer ${activeCount + 1}`,

        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { tastingId: tastingDoc.id, participantId: pRef.id };
    });

    // 3) Session setzen
    await createSession({ tastingId: result.tastingId, participantId: result.participantId });

    return NextResponse.json({ ok: true, participantId: result.participantId });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const msg = e?.message ?? "Join failed";
    return NextResponse.json({ error: msg }, { status });
  }
}
