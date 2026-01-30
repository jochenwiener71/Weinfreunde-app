import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") ?? "").trim();

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const tastingQ = await db()
    .collection("tastings")
    .where("publicSlug", "==", slug)
    .limit(1)
    .get();

  if (tastingQ.empty) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tastingDoc = tastingQ.docs[0];
  const tastingId = tastingDoc.id;
  const t = tastingDoc.data() as any;

  if (t.status !== "revealed") {
    return NextResponse.json({ error: "Summary available after reveal" }, { status: 403 });
  }

  const [criteriaSnap, winesSnap, ratingsSnap] = await Promise.all([
    db().collection("tastings").doc(tastingId).collection("criteria").orderBy("order", "asc").get(),
    db().collection("tastings").doc(tastingId).collection("wines").orderBy("blindNumber", "asc").get(),
    db().collection("tastings").doc(tastingId).collection("ratings").get(),
  ]);

  const criteria = criteriaSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const wines = winesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const ratings = ratingsSnap.docs.map((d) => d.data() as any);

  const byWine: Record<string, any> = {};
  for (const w of wines) {
    byWine[w.id] = {
      wineId: w.id,
      blindNumber: w.blindNumber,
      displayName: w.displayName ?? null,
      winery: w.winery ?? null,
      grape: w.grape ?? null,
      vintage: w.vintage ?? null,
      count: 0,
      sumTotal: 0,
      sumByCriterion: Object.fromEntries(criteria.map((c) => [c.id, 0])),
      avgTotal: null as number | null,
      avgByCriterion: {} as Record<string, number | null>,
    };
  }

  for (const r of ratings) {
    const agg = byWine[r.wineId];
    if (!agg) continue;

    agg.count += 1;

    let n = 0;
    let total = 0;
    for (const c of criteria) {
      const v = Number(r.scores?.[c.id]);
      if (!Number.isFinite(v)) continue;
      agg.sumByCriterion[c.id] += v;
      total += v;
      n += 1;
    }
    if (n > 0) agg.sumTotal += total / n;
  }

  const rows = Object.values(byWine).map((a: any) => {
    if (a.count > 0) {
      a.avgTotal = Number((a.sumTotal / a.count).toFixed(2));
      for (const c of criteria) {
        a.avgByCriterion[c.id] = Number((a.sumByCriterion[c.id] / a.count).toFixed(2));
      }
    } else {
      a.avgTotal = null;
      for (const c of criteria) a.avgByCriterion[c.id] = null;
    }
    return a;
  });

  rows.sort((x: any, y: any) => {
    if (x.avgTotal == null && y.avgTotal == null) return x.blindNumber - y.blindNumber;
    if (x.avgTotal == null) return 1;
    if (y.avgTotal == null) return -1;
    return y.avgTotal - x.avgTotal;
  });

  return NextResponse.json({
    tasting: { id: tastingId, title: t.title, hostName: t.hostName, publicSlug: t.publicSlug, status: t.status },
    criteria,
    ranking: rows,
  });
}
