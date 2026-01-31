import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type Criterion = { id: string; label: string; order?: number };

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function safeKeys(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj).slice(0, 60);
}

function safePreview(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const out: any = {};
  for (const k of Object.keys(obj).slice(0, 25)) {
    const v = (obj as any)[k];
    if (Array.isArray(v)) out[k] = `[array len=${v.length}]`;
    else if (v && typeof v === "object") out[k] = `{keys: ${Object.keys(v).slice(0, 12).join(", ")}${Object.keys(v).length > 12 ? ", …" : ""}}`;
    else out[k] = v;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const publicSlug = String(url.searchParams.get("publicSlug") ?? "").trim();
    const debug = String(url.searchParams.get("debug") ?? "").trim() === "1";

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

    // ✅ Load wines to map wineId -> blindNumber
    const wSnap = await tRef.collection("wines").get();
    const wineIdToBlind: Record<string, number> = {};
    for (const w of wSnap.docs) {
      const wd: any = w.data();
      const blind = toNum(wd?.blindNumber) ?? toNum(wd?.number) ?? null;
      if (blind !== null) {
        wineIdToBlind[w.id] = blind;
      }
    }

    // Load ratings
    const rSnap = await tRef.collection("ratings").get();

    // Debug samples
    const debugSamples = debug
      ? rSnap.docs.slice(0, 5).map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            keys: safeKeys(data),
            preview: safePreview(data),
          };
        })
      : undefined;

    // Aggregation:
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

      // ✅ your schema: wineId + scores keyed by criterionId
      const wineId = String(rd?.wineId ?? "").trim();
      const blind = wineId ? (wineIdToBlind[wineId] ?? null) : null;

      if (!blind || blind < 1) continue;

      const scores = rd?.scores && typeof rd.scores === "object" ? rd.scores : null;
      if (!scores) continue;

      // scores keys are criterion IDs
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
      ...(debug ? { debugSamples, wineIdToBlind } : {}),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Summary failed" }, { status: 500 });
  }
}
