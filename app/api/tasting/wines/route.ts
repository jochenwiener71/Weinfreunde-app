import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function str(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    const snap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tastingDoc = snap.docs[0];
    const tData = tastingDoc.data() as any;

    const winesSnap = await tastingDoc.ref.collection("wines").get();

    const wines = winesSnap.docs.map((d) => {
      const w = d.data() as any;
      return {
        id: d.id,
        blindNumber: typeof w.blindNumber === "number" ? w.blindNumber : null,
        serveOrder: typeof w.serveOrder === "number" ? w.serveOrder : null,
        ownerName: str(w.ownerName),
        winery: str(w.winery),
        grape: str(w.grape),
        vintage: str(w.vintage),
        imageUrl: str(w.imageUrl),
        imagePath: str(w.imagePath),
      };
    });

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId: tastingDoc.id,
      status: str(tData.status) ?? "",
      wineCount: Number(tData.wineCount ?? wines.length),
      wines,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to load wines" },
      { status: 500 }
    );
  }
}
