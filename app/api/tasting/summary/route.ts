import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

type Criterion = { id: string; label: string; order?: number };

function num(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function pickBlindNumber(doc: any): number | null {
  // support common keys
  return (
    num(doc?.blindNumber) ??
    num(doc?.wineNumber) ??
    num(doc?.wineNo) ??
    num(doc?.wine) ??
    null
  );
}

function pickScores(doc: any): Record<string, any> {
  // support common shapes
  // - scores: { "Nase": 7, "Gaumen": 8 }
  // - ratings: { ... }
  // - values:  { ... }
  return (
    (doc?.scores && typeof doc.scores === "object" ? doc.scores : null) ??
    (doc?.ratings && typeof doc.ratings === "object" ? doc.ratings : null) ??
    (doc?.values && typeof doc.values === "object" ? doc.values : null) ??
    {}
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const publicSlug = (url.searchParams.get("publicSlug") ?? "").trim();

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

    const tRef = tSnap.docs[0].ref;
    const tData: any = tSnap.docs[0].data();

    const status = String(tData?.status ?? "draft");
    const wineCount = Number(tData?.wineCount ?? 0);

    // Load criteria (ordered)
    const cSnap = await tRef.collection("criteria").orderBy("order", "asc").get();
    const criteria: Criterion[] = cSnap.docs.map((d) => {
      const data: any = d.data();
      return {
        id: d.id,
        label: String(data?.label ?? "").trim(),
        order: Number(data?.order ?? 0),
      };
    }).filter((c) => c.label.length > 0);

    // If not revealed, still return meta (page can show "not revealed")
    if (status !== "revealed") {
      return NextResponse.json({
        ok: true,
        publicSlug,
        tastingId: tRef.id,
        status,
        wineCount,
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

    for (const r of rSnap.docs) {
      const rd: any = r.data();
      const blind = pickBlindNumber(rd);
      if (!blind || blind < 1) continue;

      const scores = pickScores(rd);

      if (!wineAgg[blind]) wineAgg[blind] = {};
      if (!wineOverall[blind]) wineOverall[blind] = { sum: 0, count: 0 };

      // For each criterion, try multiple keys:
      // 1) criterion label (e.g. "Nase")
      // 2) criterion id (doc id in criteria collection)
      // 3) lowercase label
      for (const c of criteria) {
        const v =
          num(scores?.[c.label]) ??
          num(scores?.[c.id]) ??
          num(scores?.[c.label.toLowerCase()]);

        if (v === null) continue;

        if (!wineAgg[blind][c.label]) wineAgg[blind][c.label] = { sum: 0, count: 0 };
        wineAgg[blind][c.label].sum += v;
        wineAgg[blind][c.label].count += 1;

        wineOverall[blind].sum += v;
        wineOverall[blind].count += 1;
      }
    }

    // Build rows 1..wineCount (or infer max from ratings if wineCount missing)
    const maxWine =
      Number.isFinite(wineCount) && wineCount > 0
        ? wineCount
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

    // Ranking by overall desc, nulls last
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), // informational
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Summary failed" },
      { status: 500 }
    );
  }
}
