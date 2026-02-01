import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type Criterion = { id: string; label: string; order: number };

type SummaryRow = {
  blindNumber: number;
  perCrit: Record<string, number | null>;
  overall: number | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ error: "Missing publicSlug" }, { status: 400 });
    }

    // find tasting
    const tSnap = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (tSnap.empty) {
      return NextResponse.json({ error: "Tasting not found" }, { status: 404 });
    }

    const tDoc = tSnap.docs[0];
    const tastingId = tDoc.id;
    const t = tDoc.data() as any;

    // criteria
    const cSnap = await db()
      .collection("tastings")
      .doc(tastingId)
      .collection("criteria")
      .get();

    const criteria: Criterion[] = cSnap.docs
      .map((d) => {
        const cd = d.data() as any;
        return {
          id: d.id,
          label: String(cd.label ?? d.id),
          order: typeof cd.order === "number" ? cd.order : 999,
        };
      })
      .sort((a, b) => a.order - b.order);

    // wines (for blind numbers)
    const wSnap = await db()
      .collection("tastings")
      .doc(tastingId)
      .collection("wines")
      .get();

    const wineCount =
      typeof t.wineCount === "number" ? t.wineCount : wSnap.size;

    // build blind number list (1..wineCount)
    const rows: SummaryRow[] = Array.from({ length: wineCount }, (_, i) => {
      const blindNumber = i + 1;
      const perCrit: Record<string, number | null> = {};
      for (const c of criteria) perCrit[c.label] = null;
      return { blindNumber, perCrit, overall: null };
    });

    // ratings
    const rSnap = await db()
      .collection("tastings")
      .doc(tastingId)
      .collection("ratings")
      .get();

    // aggregate: blindNumber -> criterionLabel -> values[]
    const agg: Record<number, Record<string, number[]>> = {};

    for (const doc of rSnap.docs) {
      const rd = doc.data() as any;
      const wineId = String(rd.wineId ?? "");
      if (!wineId) continue;

      const wDoc = wSnap.docs.find((w) => w.id === wineId);
      const wd = wDoc ? (wDoc.data() as any) : null;
      const blindNumber =
        wd && typeof wd.blindNumber === "number" ? wd.blindNumber : null;

      if (!blindNumber || blindNumber < 1) continue;

      const scores = (rd.scores ?? {}) as Record<string, any>;
      if (!agg[blindNumber]) agg[blindNumber] = {};

      for (const c of criteria) {
        const raw = scores[c.id];
        const val = typeof raw === "number" ? raw : null;
        if (val == null) continue;

        const label = c.label;
        if (!agg[blindNumber][label]) agg[blindNumber][label] = [];
        agg[blindNumber][label].push(val);
      }
    }

    // compute averages
    for (const row of rows) {
      const per = agg[row.blindNumber] ?? {};

      let sumOverall = 0;
      let countOverall = 0;

      for (const c of criteria) {
        const vals = per[c.label] ?? [];
        if (!vals.length) {
          row.perCrit[c.label] = null;
          continue;
        }

        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const rounded = Math.round(avg * 100) / 100;
        row.perCrit[c.label] = rounded;

        sumOverall += avg;
        countOverall++;
      }

      row.overall =
        countOverall > 0
          ? Math.round((sumOverall / countOverall) * 100) / 100
          : null;
    }

    const ranking = rows
      .filter((r) => typeof r.overall === "number")
      .slice()
      .sort((a, b) => (b.overall ?? -999) - (a.overall ?? -999));

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId,
      status: t.status ?? null,
      wineCount,
      criteria: criteria.map((c) => ({
        id: c.id,
        label: c.label,
        order: c.order,
      })),
      rows,
      ranking,
      ratingCount: rSnap.size,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error" },
      { status: 500 }
    );
  }
}
