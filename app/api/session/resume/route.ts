import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug ?? "").trim();
    const name = String(body.name ?? "").trim();
    const pin = String(body.pin ?? "").trim();

    if (!slug || !name || !pin) {
      return NextResponse.json({ ok: false, error: "Missing slug/name/pin" }, { status: 400 });
    }

    // ✅ Teilnehmer im Tasting finden (dein participants-Setup)
    const tq = await db().collection("tastings").where("publicSlug", "==", slug).limit(1).get();
    if (tq.empty) return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });

    const tastingDoc = tq.docs[0];

    const pq = await tastingDoc.ref
      .collection("participants")
      .where("name", "==", name)
      .limit(1)
      .get();

    if (pq.empty) {
      return NextResponse.json({ ok: false, error: "Teilnehmer nicht gefunden" }, { status: 401 });
    }

    const participantDoc = pq.docs[0];
    const p = participantDoc.data() as any;

    // ✅ PIN prüfen (Feldname ggf. anpassen!)
    // wenn du pinHash nutzt statt pin → sag kurz, dann passe ich es dir an.
    if (String(p.pin ?? "") !== pin) {
      return NextResponse.json({ ok: false, error: "PIN falsch" }, { status: 401 });
    }

    // ✅ Session-Cookie setzen
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, {
      participantId: participantDoc.id,
      participantName: String(p.name ?? name),
      tastingId: tastingDoc.id,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Resume failed" }, { status: 500 });
  }
}
