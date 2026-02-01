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
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();
    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    // find tasting by publicSlug
    const snap = await db
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

    const winesSnap = await db
      .collection("tastings")
      .doc(tastingId)
      .collection("wines")
      .get();

    const revealed = status === "revealed";

    const wines: WineSlotPublic[] = winesSnap.docs
      .map((w) => {
        const wd = w.data() as any;

        // vor Reveal: nur Nummern/Order, Rest null
        return {
          id: w.id,
          blindNumber: typeof wd.blindNumber === "number" ? wd.blindNumber : null,
          serveOrder: typeof wd.serveOrder === "number" ? wd.serveOrder : null,

          ownerName: revealed && typeof wd.ownerName === "string" ? wd.ownerName : null,
          winery: revealed && typeof wd.winery === "string" ? wd.winery : null,
          grape: revealed && typeof wd.grape === "string" ? wd.grape : null,
          vintage: revealed && typeof wd.vintage === "string" ? wd.vintage : null,
        };
      })
      .sort((a, b) => (a.blindNumber ?? 999) - (b.blindNumber ?? 999));

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId,
      status,
      wines,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
