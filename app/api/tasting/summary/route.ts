import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type Criterion = { id: string; label: string; order?: number };

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const publicSlug = String(url.searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    // Find tasting
    const tSnap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tSnap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tDoc = tSnap.docs[0];
    const tRef = tDoc.ref;
    const tData: any = tDoc.data();

    const status = String(tData?.status ?? "draft");
    const wineCountRaw = Number(tData?.wineCount ?? 0);

    // Criteria
    const cSnap = await tRef.collection("criteria").orderBy("order", "asc").get();
    const criteria: Criterion[] = cSnap.docs
      .map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          label: String(data?.label ?? "").trim(),
          order: Number(data?.order ?? 0),
        };
      })
      .filter((c) => c.label.length > 0);

    // Wines: map wineId -> blindNumber and collect meta by blindNumber
    const wSnap = await tRef.collection("wines").get();
    const wineIdToBlind: Record<string, number> = {};
    const wineMetaByBlind: Record<
      number,
      {
        wineId: string;
        blindNumber: number;
        displayName: string | null;
        winery: string | null;
        grape: string | null;
        vintage: string | number | null;
      }
    > = {};

    for (const w of wSnap.docs) {
      const wd: any = w.data();
      const blind = toNum(wd?.blindNumber) ?? toNum(wd?.number) ?? null;
      if (blind === null) continue;

      wineIdToBlind[w.id] = blind;
      wineMetaByBlind[blind] = {
        wineId: w.id,
        blindNumber: blind,
        displayName: wd?.displayName ?? wd?.name ?? null,
        winery: wd?.winery ?? null,
        grape: wd?.grape ?? null,
        vintage: wd?.vintage ?? null,
      };
    }

    if (status !== "revealed") {
      // Return minimal response even before reveal, but include wineCount/criteria
      const maxWine =
        Number.isFinite(wineCountRaw) && wineCountRaw > 0
          ? wineCountRaw
          : Math.max(0, ...Object.values(wineIdToBlind));

      return NextResponse.json({
        ok: true,
        publicSlug,
        tastingId: tRef.id,
        status,
        wineCount: maxWine,
        criteria,
        rows: Array.from({ length: maxWine }, (_, i) => ({
          blindNumber: i + 1,
          wine: wineMetaByBlind[i + 1] ?? null,
          perCrit: Object.fromEntries(criteria.map((c) => [c.label, null])),
          overall: null,
        })),
        ranking: [],
        ratingCount: 0,
      });
    }

    // Ratings
    const rSnap = await tRef.collection("ratings").get();

    const wineAgg: Record<number, Record<string, { sum: number; count: number }>> = {};
    const wineOverall: Record<number, { sum: number; count: number }> = {};

    function addScore(blind: number, critLabel: string, v: number) {
      if (!wineAgg[blind]) wineAgg[blind] = {};
      if (!wineAgg[blind][critLabel]) wineAgg[blind][critLabel] = { sum: 0, count: 0 };
      wineAgg[blind][critLabel].sum += v;
      wineAgg[blind][critLabel].count += 1;

      if (!wineOverall[blind]) wineOverall[blind] = { sum: 0, count: 0 };
      wineOverall[blind].sum += v;
      wineOverall[blind].count += 1;
    }

    for (const r of rSnap.docs) {
      const rd: any = r.data();

      // your schema:
      const wineId = String(rd?.wineId ?? "").trim();
      const blind = wineId ? (wineIdToBlind[wineId] ?? null) : null;
      if (!blind || blind < 1) continue;

      const scores = rd?.scores && typeof rd.scores === "object" ? rd.scores : null;
      if (!scores) continue;

      // scores keys = criterionId
      for (const c of criteria) {
        const v = toNum(scores?.[c.id]);
        if (v !== null) addScore(blind, c.label, v);
      }
    }

    const maxWine =
      Number.isFinite(wineCountRaw) && wineCountRaw > 0
        ? wineCountRaw
        : Math.max(0, ...Object.values(wineIdToBlind));

    const rows = Array.from({ length: maxWine }, (_, i) => i + 1).map((blindNumber) => {
      const perCrit: Record<string, number | null> = {};
      for (const c of criteria) {
        const cell = wineAgg?.[blindNumber]?.[c.label];
        perCrit[c.label] = cell && cell.count > 0 ? cell.sum / cell.count : null;
      }
      const o = wineOverall?.[blindNumber];
      const overall = o && o.count > 0 ? o.sum / o.count : null;

      return {
        blindNumber,
        wine: wineMetaByBlind[blindNumber] ?? null,
        perCrit,
        overall,
      };
    });

    const ranking = [...rows]
      .filter((r) => r.overall !== null)
      .sort((a, b) => (b.overall! - a.overall!));

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId: tRef.id,
      status,
      wineCount: maxWine,
      criteria,
      rows,
      ranking,
      ratingCount: rSnap.size,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Summary failed" }, { status: 500 });
  }
}
