import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

type ParticipantOut = {
  id: string;
  name: string | null;
  isActive: boolean;
};

async function getTastingDocByPublicSlug(publicSlug: string) {
  const snap = await db()
    .collection("tastings")
    .where("publicSlug", "==", publicSlug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0];
}

function pickName(p: any): string | null {
  const v =
    p?.name ??
    p?.firstName ??
    p?.displayName ??
    p?.participantName ??
    p?.username ??
    null;

  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pickIsActive(p: any): boolean {
  // Unterstützt mehrere mögliche Schemata
  if (typeof p?.isActive === "boolean") return p.isActive;
  if (typeof p?.active === "boolean") return p.active;
  if (typeof p?.status === "string") return p.status === "active";
  // default: true (damit neue Teilnehmer nicht als „inaktiv“ erscheinen)
  return true;
}

export async function GET(req: Request) {
  try {
    requireAdminSecret(req);

    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    const tDoc = await getTastingDocByPublicSlug(publicSlug);
    if (!tDoc) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const pSnap = await tDoc.ref.collection("participants").get();

    const participants: ParticipantOut[] = pSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: pickName(data),
        isActive: pickIsActive(data),
      };
    });

    // Optional: sortiere nach Name, sonst nach ID
    participants.sort((a, b) => {
      const an = (a.name ?? "").toLowerCase();
      const bn = (b.name ?? "").toLowerCase();
      if (an && bn && an !== bn) return an.localeCompare(bn);
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json({ ok: true, participants });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
