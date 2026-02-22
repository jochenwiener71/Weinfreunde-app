// app/api/admin/list-participants/route.ts
import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

/**
 * Robust: findet einen Namen egal wie er gespeichert wurde
 */
function pickName(p: any): string | null {
  const candidates = [
    p?.alias,
    p?.name,
    p?.firstName,
    p?.displayName,
    p?.participantName,
    p?.username,
    p?.profile?.name,
    p?.profile?.firstName,
    p?.user?.name,
    p?.user?.displayName,
  ];

  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * ✅ FIX:
 * Wenn kein isActive Feld existiert,
 * gilt der Teilnehmer als aktiv.
 */
function pickIsActive(p: any): boolean {
  if (typeof p?.isActive === "boolean") return p.isActive;
  if (typeof p?.active === "boolean") return p.active;
  if (typeof p?.joined === "boolean") return p.joined;

  // Default: aktiv
  return true;
}

async function getTastingRefByPublicSlug(
  publicSlug: string
): Promise<admin.firestore.DocumentReference | null> {
  const snap = await db()
    .collection("tastings")
    .where("publicSlug", "==", publicSlug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].ref;
}

export async function GET(req: Request) {
  try {
    // 🔐 Admin-Schutz
    requireAdminSecret(req);

    const { searchParams } = new URL(req.url);
    const publicSlug = (searchParams.get("publicSlug") ?? "").trim();
    const debug = searchParams.get("debug") === "1";

    if (!publicSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing publicSlug" },
        { status: 400 }
      );
    }

    const tastingRef = await getTastingRefByPublicSlug(publicSlug);
    if (!tastingRef) {
      return NextResponse.json(
        { ok: false, error: "Tasting not found" },
        { status: 404 }
      );
    }

    const snap = await tastingRef.collection("participants").get();

    const participants = snap.docs.map((d) => {
      const data = d.data() ?? {};
      return {
        id: d.id,
        name: pickName(data),
        isActive: pickIsActive(data),
        ...(debug ? { _keys: Object.keys(data) } : {}),
      };
    });

    return NextResponse.json({
      ok: true,
      count: participants.length,
      participants,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
