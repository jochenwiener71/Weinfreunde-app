// app/api/join/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { verifyPin } from "@/lib/security";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

function normName(v: any) {
  return String(v ?? "").trim();
}

function normPin(v: any) {
  return String(v ?? "").trim();
}

function normSlug(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // ✅ tolerant field mapping (frontend variations)
    const publicSlug = normSlug(body?.publicSlug ?? body?.slug);
    const name = normName(
      body?.name ??
      body?.vorname ??
      body?.firstName ??
      body?.participantName
    );
    const pin = normPin(
      body?.pin ??
      body?.code ??
      body?.passcode
    );

    if (!publicSlug)
      return NextResponse.json({ ok: false, error: "Missing publicSlug" }, { status: 400 });
    if (!name)
      return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
    if (!pin)
      return NextResponse.json({ ok: false, error: "Missing pin" }, { status: 400 });

    // 1) tasting by publicSlug
    const tq = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tq.empty)
      return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });

    const tastingDoc = tq.docs[0];

    // 2) PIN prüfen
    const pinRes: any = await verifyPin(tastingDoc.id, pin);
    const pinOk = typeof pinRes === "boolean" ? pinRes : !!pinRes?.ok;

    if (!pinOk) {
      return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 401 });
    }

    // 3) Participant holen oder erzeugen
    const nameLower = name.toLowerCase();
    let pId: string | null = null;

    const pQ1 = await tastingDoc.ref
      .collection("participants")
      .where("nameLower", "==", nameLower)
      .limit(1)
      .get();

    if (!pQ1.empty) {
      pId = pQ1.docs[0].id;
    } else {
      const pQ2 = await tastingDoc.ref
        .collection("participants")
        .where("name", "==", name)
        .limit(1)
        .get();

      if (!pQ2.empty) {
        pId = pQ2.docs[0].id;
      }
    }

    if (!pId) {
      const pRef = tastingDoc.ref.collection("participants").doc();
      await pRef.set({
        name,
        nameLower,
        createdAt: new Date(),
      });
      pId = pRef.id;
    }

    // 4) Session cookie setzen
    await createSession({
      tastingId: tastingDoc.id,
      participantId: pId,
      name,
    });

    return NextResponse.json({ ok: true, participantId: pId, name });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Join failed" },
      { status: 500 }
    );
  }
}
