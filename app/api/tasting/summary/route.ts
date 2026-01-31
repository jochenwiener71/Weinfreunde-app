import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type Criterion = { id: string; label: string; order?: number };

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function pickBlindNumber(d: any): number | null {
  return (
    toNum(d?.blindNumber) ??
    toNum(d?.wineNumber) ??
    toNum(d?.wineNo) ??
    toNum(d?.wine) ??
    toNum(d?.wineIndex) ??
    null
  );
}

function pickScoresObject(d: any): Record<string, any> | null {
  const candidates = [d?.scores, d?.ratings, d?.values, d?.byCriterion, d?.criteriaScores];
  for (const c of candidates) {
    if (c && typeof c === "object" && !Array.isArray(c)) return c as Record<string, any>;
  }
  return null;
}

function pickSingleCriterionValue(d: any): { key: string | null; value: number | null } {
  const key =
    (typeof d?.criterionId === "string" && d.criterionId.trim()) ? d.criterionId.trim() :
    (typeof d?.criterionLabel === "string" && d.criterionLabel.trim()) ? d.criterionLabel.trim() :
    (typeof d?.criterion === "string" && d.criterion.trim()) ? d.criterion.trim() :
    (typeof d?.label === "string" && d.label.trim()) ? d.label.trim() :
    null;

  const value =
    toNum(d?.value) ??
    toNum(d?.score) ??
    toNum(d?.rating) ??
    toNum(d?.points) ??
    null;

  return { key, value };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const publicSlug = String(url.searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    // Find tasting by publicSlug
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

    // Load criteria (ordered)
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

    // If not revealed, return meta only
    if (status !== "revealed") {
      return NextResponse.json({
        ok: true,
        publicSlug,
        tastingId: tRef.id,
        status,
        wineCount: wineCountRaw,
        criteria,
        message: "Not revealed yet",
      });
    }

    // Load ratings
    const rSnap = await tRef.collection("ratings").get();

    // Aggregation:
    // wineAgg[blindNumber][criterionLabel] = { sum, count }
    const wineAgg: Record<number, Record<string, { sum: number; count: number }>> = {};
    const wineOverall: Record<number, { sum: number; count: number }> = {};

    // Helper: add one criterion score
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
      const blind = pickBlindNumber(rd);
      if (!blind || blind < 1) continue;

      // Modell A: ein Doc enthält Objekt mit vielen Scores
      const scoresObj = pickScoresObject(rd);
      if (scoresObj) {
        for (const c of criteria) {
          const v =
            toNum(scoresObj?.[c.label]) ??
            toNum(scoresObj?.[c.id]) ??
            toNum(scoresObj?.[c.label.toLowerCase()]) ??
            null;

          if (v !== null) addScore(blind, c.label, v);
        }
        continue;
      }

      // Modell B: ein Doc = ein Kriterium
      const one = pickSingleCriterionValue(rd);
      if (one.key && one.value !== null) {
        // key kann criterionId ODER label sein → auf label mappen, wenn möglich
        const byId = criteria.find((c) => c.id === one.key);
        const byLabel = criteria.find((c) => c.label === one.key);
        const label = byId?.label ?? byLabel?.label ?? one.key;
        addScore(blind, label, one.value);
      }
    }

    const maxWine =
      Number.isFinite(wineCountRaw) && wineCountRaw > 0
        ? wineCountRaw
        : Math.max(0, ...Object.keys(wineAgg).map((k) => Number(k)));

    const rows = Array.from({ length: maxWine }, (_, i) => i + 1).map((blindNumber) => {
      const perCrit: Record<string, number | null> = {};
      for (const c of criteria) {
        const cell = wineAgg?.[blindNumber]?.[c.label];
        perCrit[c.label] = cell && cell.count > 0 ? cell.sum / cell.count : null;
      }

      const o = wineOverall?.[blindNumber];
      const overall = o && o.count > 0 ? o.sum / o.count : null;

      return { blindNumber, perCrit, overall };
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
