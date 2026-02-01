import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

type WineSlotPublic = {
  id: string;
  blindNumber: number | null;
  serveOrder: number | null;
  ownerName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;
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
    const data = doc.data() as any;
    const status = String(data.status ?? "");

    // wines
    const winesSnap = await db()
      .collection("tastings")
      .doc(tastingId)
      .collection("wines")
      .get();

    const revealed = status === "revealed";

    const wines: WineSlotPublic[] = winesSnap.docs
      .map((w) => {
        const wd = w.data() as any;
        const blindNumber = typeof wd.blindNumber === "number" ? wd.blindNumber : null;
        const serveOrder = typeof wd.serveOrder === "number" ? wd.serveOrder : null;

        // only reveal details after reveal
        const ownerName = revealed && typeof wd.ownerName === "string" ? wd.ownerName : null;
        const winery = revealed && typeof wd.winery === "string" ? wd.winery : null;
        const grape = revealed && typeof wd.grape === "string" ? wd.grape : null;
        const vintage = revealed && typeof wd.vintage === "string" ? wd.vintage : null;

        return {
          id: w.id,
          blindNumber,
          serveOrder,
          ownerName,
          winery,
          grape,
          vintage,
        };
      })
      .sort((a, b) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999));

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId,
      status,
      wineCount: data.wineCount ?? wines.length,
      wines,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
