import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

function requireAdminSecret(req: Request) {
  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  const provided =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  if (!expected) throw new Error("ADMIN_SECRET is not set in this deployment.");
  if (!provided || String(provided).trim() !== expected) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

function tsToIso(x: any): string | null {
  // Firestore Timestamp has toDate()
  if (x && typeof x.toDate === "function") return x.toDate().toISOString();
  return null;
}

export async function GET(req: Request) {
  try {
    requireAdminSecret(req);

    const snap = await db()
      .collection("tastings")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const tastings = snap.docs.map((d) => {
      const t = d.data() as any;
      return {
        id: d.id,
        publicSlug: String(t.publicSlug ?? ""),
        title: String(t.title ?? ""),
        hostName: String(t.hostName ?? ""),
        status: String(t.status ?? ""),
        wineCount: typeof t.wineCount === "number" ? t.wineCount : null,
        maxParticipants: typeof t.maxParticipants === "number" ? t.maxParticipants : null,

        // optional fields if you add them later
        tastingDate: String(t.tastingDate ?? ""), // e.g. "2026-02-01"
        createdAt: tsToIso(t.createdAt),
        updatedAt: tsToIso(t.updatedAt),
      };
    });

    return NextResponse.json({ ok: true, tastings });
  } catch (e: any) {
    const status = Number(e?.status ?? 500);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status });
  }
}
