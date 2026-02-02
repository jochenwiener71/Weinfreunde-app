import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireAdminSecret } from "@/lib/security";

type Criterion = { id: string; label: string; order: number; scaleMin: number; scaleMax: number };
type WineDoc = {
  id: string;
  blindNumber: number | null;
  displayName?: string | null;
  winery?: string | null;
  grape?: string | null;
  vintage?: string | null;
  isActive?: boolean;
};

function numOrNull(v: any): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function safeStr(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function GET(req: Request) {
  try {
    requireAdminSecret(req);

    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    // Find tasting
    const tSnap = await db().collection("tastings").where("publicSlug", "==", publicSlug).limit(1).get();
    if (tSnap.empty) return NextResponse.json({ error: "Tasting not found" }, { status: 404 });

    const tDoc = tSnap.docs[0];
    const t = tDoc.data() as any;

    // Load criteria + wines + ratings
    const [criteriaSnap, winesSnap, ratingsSnap] = await Promise.all([
      tDoc.ref.collection("criteria").orderBy("order", "asc").get(),
      tDoc.ref.collection("wines").orderBy("blindNumber", "asc").get(),
      tDoc.ref.collection("ratings").get(),
    ]);

    const criteria: Criterion[] = criteriaSnap.docs.map((d) => {
      const c = d.data() as any;
      return {
        id: d.id,
        label: String(c.label ?? ""),
        order: Number(c.order ?? 0),
        scaleMin: Number(c.scaleMin ?? 1),
        scaleMax: Number(c.scaleMax ?? 10),
      };
    });

    const wines: WineDoc[] = winesSnap.docs.map((d) => {
      const w = d.data() as any;
      return {
        id: d.id,
        blindNumber: numOrNull(w.blindNumber),
        displayName: safeStr(w.displayName),
        winery: safeStr(w.winery),
        grape: safeStr(w.grape),
        vintage: safeStr(w.vintage),
        isActive: typeof w.isActive === "boolean" ? w.isActive : true,
      };
    });

    const wineById = new Map<string, WineDoc>();
    wines.forEach((w) => wineById.set(w.id, w));

    // Aggregation per wineId
    type Agg = {
      wineId: string;
      blindNumber: number | null;
      nRatings: number;
      overallSum: number;
      overallCount: number;
      perCritSum: Record<string, number>;
      perCritCount: Record<string, number>;
    };

    const aggByWineId = new Map<string, Agg>();

    function getAgg(wineId: string): Agg {
      const existing = aggByWineId.get(wineId);
      if (existing) return existing;

      const wine = wineById.get(wineId);
      const a: Agg = {
        wineId,
        blindNumber: wine?.blindNumber ?? null,
        nRatings: 0,
        overallSum: 0,
        overallCount: 0,
        perCritSum: {},
        perCritCount: {},
      };
      aggByWineId.set(wineId, a);
      return a;
    }

    for (const rDoc of ratingsSnap.docs) {
      const r = rDoc.data() as any;
      const wineId = String(r.wineId ?? "").trim();
      if (!wineId) continue;

      const scores = r.scores ?? {};
      if (!scores || typeof scores !== "object" || Array.isArray(scores)) continue;

      const a = getAgg(wineId);
      a.nRatings += 1;

      // overall: average of provided numeric scores in this rating
      const vals: number[] = [];
      for (const [critId, v] of Object.entries(scores)) {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;

        // per-criterion aggregation
        a.perCritSum[critId] = (a.perCritSum[critId] ?? 0) + n;
        a.perCritCount[critId] = (a.perCritCount[critId] ?? 0) + 1;
        vals.push(n);
      }

      if (vals.length) {
        const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
        a.overallSum += avg;
        a.overallCount += 1;
      }
    }

    // Build response list aligned to wines (also include wines without ratings)
    const rows = wines
      .map((w) => {
        const a = aggByWineId.get(w.id);

        const overallAvg =
          a && a.overallCount > 0 ? Math.round((a.overallSum / a.overallCount) * 100) / 100 : null;

        const perCriteriaAvg: Record<string, number | null> = {};
        for (const c of criteria) {
          const sum = a?.perCritSum?.[c.id] ?? 0;
          const cnt = a?.perCritCount?.[c.id] ?? 0;
          perCriteriaAvg[c.id] = cnt > 0 ? Math.round((sum / cnt) * 100) / 100 : null;
        }

        return {
          wineId: w.id,
          blindNumber: w.blindNumber,
          isActive: w.isActive ?? true,
          // Show details if present (admin sees them always)
          displayName: w.displayName ?? null,
          winery: w.winery ?? null,
          grape: w.grape ?? null,
          vintage: w.vintage ?? null,
          nRatings: a?.nRatings ?? 0,
          overallAvg,
          perCriteriaAvg,
        };
      })
      .sort((a, b) => {
        // sort by overall desc, nulls last, then blindNumber asc
        const ao = a.overallAvg ?? -1;
        const bo = b.overallAvg ?? -1;
        if (bo !== ao) return bo - ao;
        return (a.blindNumber ?? 999) - (b.blindNumber ?? 999);
      });

    return NextResponse.json({
      ok: true,
      publicSlug,
      tasting: {
        id: tDoc.id,
        title: safeStr(t.title),
        hostName: safeStr(t.hostName),
        status: safeStr(t.status),
        wineCount: typeof t.wineCount === "number" ? t.wineCount : null,
      },
      criteria,
      rows,
      ratingCount: ratingsSnap.size,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
