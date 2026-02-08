// app/api/join/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { verifyPin } from "@/lib/security";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

// 🔥 Eindeutige Versionskennung
const JOIN_ROUTE_VERSION = "join-v7-debug-2026-02-08";

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
  const b: any = body && typeof body === "object" ? { ...body } : body;

  if (b?.pin) b.pin = "***";
  if (b?.code) b.code = "***";
  if (b?.passcode) b.passcode = "***";

  return b;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const publicSlug = normSlug(body?.publicSlug ?? body?.slug);
    const name = normName(body?.name);
    const pin = normPin(body?.pin);

    // ❌ publicSlug fehlt
    if (!publicSlug) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing publicSlug",
          version: JOIN_ROUTE_VERSION,
          receivedKeys: Object.keys(body ?? {}),
          receivedBody: safeDump(body),
        },
        { status: 400 }
      );
    }

    // ❌ NAME fehlt → HIER SIEHST DU DIE VERSION
    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing name",
          version: JOIN_ROUTE_VERSION,
          receivedKeys: Object.keys(body ?? {}),
          receivedBody: safeDump(body),
        },
        { status: 400 }
      );
    }

    if (!pin) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing pin",
          version: JOIN_ROUTE_VERSION,
          receivedKeys: Object.keys(body ?? {}),
          receivedBody: safeDump(body),
        },
        { status: 400 }
      );
    }

    // ---- ab hier ist alles OK ----

    const tq = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tq.empty) {
      return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });
    }

    const tastingDoc = tq.docs[0];

    const pinRes: any = await verifyPin(tastingDoc.id, pin);
    const pinOk = typeof pinRes === "boolean" ? pinRes : !!pinRes?.ok;

    if (!pinOk) {
      return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 401 });
    }

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

    await createSession({
      tastingId: tastingDoc.id,
      participantId: pId,
      name,
    });

    return NextResponse.json({
      ok: true,
      participantId: pId,
      name,
      version: JOIN_ROUTE_VERSION,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Join failed", version: JOIN_ROUTE_VERSION },
      { status: 500 }
    );
  }
}
