import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "../../../../lib/firebaseAdmin";
import { hashPin } from "../../../../lib/security";

type CriterionInput = { label: string; scaleMin: number; scaleMax: number };

function pickProvidedSecret(req: Request, body: any): { value: string; source: string } {
  const header =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  if (header && header.trim()) return { value: header.trim(), source: "header:x-admin-secret" };

  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return { value: token, source: "header:authorization(bearer)" };
  }

  const fromBody =
    body?.adminSecret ??
    body?.ADMIN_SECRET ??
    body?.admin_secret ??
    body?.secret ??
    "";

  const v = String(fromBody ?? "").trim();
  if (v) return { value: v, source: "body" };

  return { value: "", source: "none" };
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  const provided = pickProvidedSecret(req, body);

  // WICHTIG: Wenn expected leer ist, ist es ein ENV-Problem (kein Forbidden)
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not set in this deployment (Vercel env var missing or not applied)." },
      { status: 500 }
    );
  }

  if (!provided.value || provided.value !== expected) {
    return NextResponse.json(
      {
        error: "Forbidden",
        debug: {
          expectedSet: true,
          providedSource: provided.source,
          providedLength: provided.value.length,
          hint:
            provided.source === "none"
              ? "UI did not send the secret (header/body empty)."
              : "Secret was sent but does not match Vercel ADMIN_SECRET for this deployment.",
        },
      },
      { status: 403 }
    );
  }

  try {
    const publicSlug = String(body.publicSlug ?? "").trim();
    const title = String(body.title ?? "").trim();
    const hostName = String(body.hostName ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    const status = String(body.status ?? "open").trim();
    const wineCount = Number(body.wineCount ?? 10);
    const maxParticipants = Number(body.maxParticipants ?? 10);
    const criteria = (body.criteria ?? []) as CriterionInput[];

    if (!publicSlug || !title || !hostName || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const existing = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ error: "publicSlug already exists" }, { status: 409 });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const pinHash = hashPin(pin);

    const tRef = db().collection("tastings").doc();
    const batch = db().batch();

    batch.set(tRef, {
      publicSlug,
      title,
      hostName,
      status,
      wineCount,
      maxParticipants,
      pinHash,
      createdAt: now,
      updatedAt: now,
    });

    criteria.forEach((c, idx) => {
      const ref = tRef.collection("criteria").doc();
      batch.set(ref, {
        label: String(c.label ?? "").trim(),
        scaleMin: Number(c.scaleMin ?? 1),
        scaleMax: Number(c.scaleMax ?? 10),
        order: idx,
        createdAt: now,
        updatedAt: now,
      });
    });

    for (let i = 1; i <= wineCount; i++) {
      const ref = tRef.collection("wines").doc();
      batch.set(ref, {
        blindNumber: i,
        isActive: true,
        displayName: null,
        winery: null,
        grape: null,
        vintage: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();

    return NextResponse.json({ ok: true, tastingId: tRef.id, publicSlug });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Create tasting failed" }, { status: 500 });
  }
}
