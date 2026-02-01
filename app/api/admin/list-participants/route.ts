import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

function isoOrNull(v: any): string | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    requireAdminSecret(req);

    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    // find tasting
    const tSnap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tSnap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tDoc = tSnap.docs[0];

    // participants
    const pSnap = await tDoc.ref
      .collection("participants")
      // createdAt kann fehlen -> Firestore erlaubt orderBy bei fehlenden Feldern, die sortieren dann "null first"
      .orderBy("createdAt", "asc")
      .get();

    const participants = pSnap.docs.map((d) => {
      const p = d.data() as any;
      return {
        id: d.id,
        alias: typeof p.alias === "string" ? p.alias : null,
        createdAt: isoOrNull(p.createdAt),
      };
    });

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId: tDoc.id,
      count: participants.length,
      participants,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
