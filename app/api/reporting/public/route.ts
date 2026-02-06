import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

type Criterion = {
  id: string;
  label: string;
  weight: number;
  order: number;
  isActive: boolean;
  scaleMin: number;
  scaleMax: number;
};

type Wine = {
  id: string;
  blindNumber: number | null;
  displayName?: string | null;
  winery?: string | null;
  grape?: string | null;
  vintage?: string | null;
};

type Rating = {
  blindNumber: number;
  participantId: string;
  scores: Record<string, number>;
  comment: string | null;
  updatedAt: admin.firestore.Timestamp | null;
};

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = String(searchParams.get("slug") ?? "").trim();

    if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

    // 1) tasting by publicSlug
    const tq = await db().collection("tastings").where("publicSlug", "==", slug).limit(1).get();
    if (tq.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

    const tastingDoc = tq.docs[0];
    const tData = tastingDoc.data() as any;

    const revealed = !!tData.revealed; // ✅ Admin "Reveal" soll dieses Feld setzen
    const wineCount = num(tData.wineCount, 0);

    // 2) criteria
    const critSnap = await tastingDoc.ref.collection("criteria").get();
    const criteria: Criterion[] = critSnap.docs
      .map((d) => {
        const c = d.data() as any;
        return {
          id: d.id,
          label: String(c.label ?? c.name ?? d.id),
          weight: num(c.weight, 1),
          order: num(c.order, 999999),
          isActive: typeof c.isActive === "boolean" ? c.isActive : true,
          scaleMin: num(c.scaleMin, 1),
          scaleMax: num(c.scaleMax, 10),
        };
      })
      .sort((a, b) => a.order - b.order);

    const activeCriteria = criteria.filter((c) => c.isActive);

    // 3) wines (für mapping blindNumber -> details)
    const winesSnap = await tastingDoc.ref.collection("wines").get();
    const wines: Wine[] = winesSnap.docs.map((d) => {
      const w = d.data() as any;
      return {
        id: d.id,
        blindNumber: Number.isFinite(Number(w.blindNumber)) ? Number(w.blindNumber) : null,
        displayName: str(w.displayName ?? w.name),
        winery: str(w.winery),
        grape: str(w.grape),
        vintage: str(w.vintage),
      };
    });

    const wineByBlind: Record<number, Wine> = {};
    for (const w of wines) {
      if (typeof w.blindNumber === "number" && w.blindNumber > 0) {
        wineByBlind[w.blindNumber] = w;
      }
    }

    // 4) ratings
    const ratingsSnap = await tastingDoc.ref.collection("ratings").get();
    const ratings: Rating[] = ratingsSnap.docs
      .map((d) => {
        const r = d.data() as any;
        return {
          blindNumber: num(r.blindNumber, 0),
          participantId: String(r.participantId ?? ""),
          scores: (r.scores && typeof r.scores === "object") ? r.scores : {},
          comment: str(r.comment),
          updatedAt: (r.updatedAt ?? null) as any,
        };
      })
      .filter((r) => r.blindNumber >= 1);

    // 5) aggregate per blindNumber
    type Agg = {
      blindNumber: number;
      count: number;
      avgByCriterion: Record<string, number>;
      totalAvg: number | null;
      wine: any | null;
    };

    const grouped: Record<number, Rating[]> = {};
    for (const r of ratings) {
      grouped[r.blindNumber] = grouped[r.blindNumber] ?? [];
      grouped[r.blindNumber].push(r);
    }

    const allBlindNumbers = new Set<number>();
    if (wineCount > 0) for (let i = 1; i <= wineCount; i++) allBlindNumbers.add(i);
    for (const k of Object.keys(grouped)) allBlindNumbers.add(Number(k));

    const result: Agg[] = Array.from(allBlindNumbers)
      .filter((n) => Number.isFinite(n) && n >= 1)
      .sort((a, b) => a - b)
      .map((bn) => {
        const list = grouped[bn] ?? [];
        const count = list.length;

        const sums: Record<string, number> = {};
        for (const c of activeCriteria) sums[c.id] = 0;

        for (const r of list) {
          for (const c of activeCriteria) {
            const v = num(r.scores?.[c.id], c.scaleMin);
            sums[c.id] += v;
          }
        }

        const avgByCriterion: Record<string, number> = {};
        for (const c of activeCriteria) {
          avgByCriterion[c.id] = count ? Number((sums[c.id] / count).toFixed(2)) : c.scaleMin;
        }

        // weighted total average
        const weightSum = activeCriteria.reduce((acc, c) => acc + num(c.weight, 1), 0) || 1;
        const totalAvg = count
          ? Number(
              (
                activeCriteria.reduce((acc, c) => acc + avgByCriterion[c.id] * num(c.weight, 1), 0) /
                weightSum
              ).toFixed(2)
            )
          : null;

        const wine = revealed
          ? {
              blindNumber: bn,
              displayName: wineByBlind[bn]?.displayName ?? null,
              winery: wineByBlind[bn]?.winery ?? null,
              grape: wineByBlind[bn]?.grape ?? null,
              vintage: wineByBlind[bn]?.vintage ?? null,
            }
          : { blindNumber: bn };

        return { blindNumber: bn, count, avgByCriterion, totalAvg, wine };
      });

    // 6) rank (nur wenn totalAvg vorhanden)
    const ranked = result
      .slice()
      .sort((a, b) => (b.totalAvg ?? -999) - (a.totalAvg ?? -999))
      .map((x, i) => ({ ...x, rank: x.totalAvg == null ? null : i + 1 }));

    return NextResponse.json({
      ok: true,
      slug,
      revealed,
      tasting: {
        title: str(tData.title) ?? "",
        hostName: str(tData.hostName) ?? "",
        status: str(tData.status) ?? "",
        wineCount,
      },
      criteria,
      wines: ranked,
      totals: {
        ratingsCount: ratings.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Reporting failed" }, { status: 500 });
  }
}
