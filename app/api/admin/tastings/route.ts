import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

export async function GET(req: Request) {
  try {
    requireAdminSecret(req);

    const snap = await db()
      .collection("tastings")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const tastings = snap.docs.map((d) => {
      const t = d.data() as any;
      return {
        id: d.id,
        publicSlug: typeof t.publicSlug === "string" ? t.publicSlug : null,
        title: typeof t.title === "string" ? t.title : null,
        hostName: typeof t.hostName === "string" ? t.hostName : null,
        status: typeof t.status === "string" ? t.status : null,
        wineCount: typeof t.wineCount === "number" ? t.wineCount : null,
        maxParticipants: typeof t.maxParticipants === "number" ? t.maxParticipants : null,
        date: typeof t.date === "string" ? t.date : null,
        createdAt: t.createdAt ?? null,
        updatedAt: t.updatedAt ?? null,
      };
    });

    return NextResponse.json({ ok: true, tastings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
