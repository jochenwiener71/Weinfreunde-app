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

function safeDump(body: any) {
  // Make a shallow clone and mask secrets so you can paste it safely
  const b: any = body && typeof body === "object" ? { ...body } : body;

  const mask = (obj: any, key: string) => {
    if (obj && typeof obj === "object" && key in obj) obj[key] = "***";
  };

  mask(b, "pin");
  mask(b, "code");
  mask(b, "passcode");

  // Also try masking nested common spots
  if (b?.participant) {
    mask(b.participant, "pin");
    mask(b.participant, "code");
    mask(b.participant, "passcode");
  }
  if (b?.user) {
    mask(b.user, "pin");
    mask(b.user, "code");
    mask(b.user, "passcode");
  }

  return b;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // ✅ tolerant field mapping (frontend variations)
    const publicSlug = normSlug(body?.publicSlug ?? body?.slug);

    // ✅ accept MANY possible name fields, incl. nested objects
    const name = normName(
      body?.name ??
        body?.vorname ??
        body?.firstName ??
        body?.firstname ??
        body?.givenName ??
        body?.displayName ??
        body?.userName ??
        body?.participantName ??
        body?.participant?.name ??
        body?.participant?.vorname ??
        body?.participant?.firstName ??
        body?.user?.name ??
        body?.user?.vorname ??
        body?.profile?.name
    );

    const pin = normPin(body?.pin ?? body?.code ?? body?.passcode);

    // ✅ DEBUG: return what we actually received (safe masked)
    if (!publicSlug) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing publicSlug",
          receivedKeys: Object.keys(body ?? {}),
          receivedBody: safeDump(body),
        },
        { status: 400, headers: { "x-debug-join": "1" } }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing name",
          receivedKeys: Object.keys(body ?? {}),
          receivedBody: safeDump(body),
        },
        { status: 400, headers: { "x-debug-join": "1" } }
      );
    }

    if (!pin) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing pin",
          receivedKeys: Object.keys(body ?? {}),
          receivedBody: safeDump(body),
        },
        { status: 400, headers: { "x-debug-join": "1" } }
      );
    }

    // 1) tasting by publicSlug
    const tq = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
    if (tq.empty) return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });

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

    const pQ1 = await tastingDoc.ref.collection("participants").where("nameLower", "==", nameLower).limit(1).get();
    if (!pQ1.empty) {
      pId = pQ1.docs[0].id;
    } else {
      const pQ2 = await tastingDoc.ref.collection("participants").where("name", "==", name).limit(1).get();
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
    return NextResponse.json({ ok: false, error: e?.message ?? "Join failed" }, { status: 500 });
  }
}
