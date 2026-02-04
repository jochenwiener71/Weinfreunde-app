import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type WineSlotPublic = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;

  // bottle photo
  imageUrl: string | null;
  imagePath: string | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    // find tasting by publicSlug
    const snap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const doc = snap.docs[0];
    const tastingId = doc.id;
    const t = doc.data() as any;

    const status = String(t.status ?? "");
    const wineCount = typeof t.wineCount === "number" ? t.wineCount : null;

    // wines
    const winesSnap = await db()
      .collection("tastings")
      .doc(tastingId)
      .collection("wines")
      .get();

    // ✅ Reporting/Public: Details immer anzeigen (keine Conditionals mehr)
    const wines: WineSlotPublic[] = winesSnap.docs
      .map((w) => {
        const wd = w.data() as any;

        return {
          id: w.id,
          blindNumber: typeof wd.blindNumber === "number" ? wd.blindNumber : null,
          serveOrder: typeof wd.serveOrder === "number" ? wd.serveOrder : null,

          ownerName: typeof wd.ownerName === "string" ? wd.ownerName : null,
          winery: typeof wd.winery === "string" ? wd.winery : null,
          grape: typeof wd.grape === "string" ? wd.grape : null,
          vintage: typeof wd.vintage === "string" ? wd.vintage : null,

          imageUrl: typeof wd.imageUrl === "string" ? wd.imageUrl : null,
          imagePath: typeof wd.imagePath === "string" ? wd.imagePath : null,
        };
      })
      .sort((a, b) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999));

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId,
      status,
      wineCount: wineCount ?? wines.length,
      wines,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
