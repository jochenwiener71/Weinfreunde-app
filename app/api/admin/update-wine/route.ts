import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

function getProvidedSecret(req: Request, body: any) {
  const h = req.headers.get("x-admin-secret") || req.headers.get("X-Admin-Secret") || "";
  if (h && h.trim()) return h.trim();
  const fromBody = String(body?.adminSecret ?? "").trim();
  return fromBody;
}

function cleanStr(x: any) {
  const s = String(x ?? "").trim();
  return s.length ? s : null;
}

function cleanNum(x: any) {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_SECRET is not set in this deployment." }, { status: 500 });
  }

  const provided = getProvidedSecret(req, body);
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const publicSlug = String(body?.publicSlug ?? "").trim();
  const blindNumber = Number(body?.blindNumber ?? NaN);
  const patch = body?.patch ?? {};

  if (!publicSlug) return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
  if (!Number.isFinite(blindNumber) || blindNumber < 1) {
    return NextResponse.json({ error: "Invalid blindNumber" }, { status: 400 });
  }

  // Find tasting
  const tSnap = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
  if (tSnap.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

  const tDoc = tSnap.docs[0];
  const tRef = tDoc.ref;

  // Find wine by blindNumber
  const wSnap = await tRef.collection("wines").where("blindNumber", "==", blindNumber).limit(1).get();
  if (wSnap.empty) return NextResponse.json({ error: "Wine not found" }, { status: 404 });

  const wDoc = wSnap.docs[0];

  const update: any = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Allowed fields
  if ("ownerName" in patch) update.ownerName = cleanStr(patch.ownerName);
  if ("serveOrder" in patch) update.serveOrder = cleanNum(patch.serveOrder);

  if ("displayName" in patch) update.displayName = cleanStr(patch.displayName);
  if ("winery" in patch) update.winery = cleanStr(patch.winery);
  if ("grape" in patch) update.grape = cleanStr(patch.grape);

  if ("vintage" in patch) update.vintage = cleanNum(patch.vintage);

  await wDoc.ref.update(update);

  return NextResponse.json({
    ok: true,
    publicSlug,
    blindNumber,
    wineId: wDoc.id,
    updated: Object.keys(update).filter((k) => k !== "updatedAt"),
  });
}
