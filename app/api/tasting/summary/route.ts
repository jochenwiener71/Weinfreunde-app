// app/api/tasting/summary/route.ts
import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type Criterion = {
  id: string;
  label: string;
  order: number;
  isActive?: boolean | null;
};

type RatingDoc = {
  participantId?: string;
  blindNumber?: number;
  scores?: Record<string, number>;
  comment?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getTastingBySlug(publicSlug: string) {
  const snap = await db()
    .collection("tastings")
    .where("publicSlug", "==", publicSlug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0];
}

async function getCriteria(tastingRef: admin.firestore.DocumentReference): Promise<Criterion[]> {
  // Erwartet: subcollection "criteria"
  const snap = await tastingRef.collection("criteria").get();
  const arr: Criterion[] = snap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      label: String(x?.label ?? x?.name ?? d.id),
      order: Number.isFinite(Number(x?.order)) ? Number(x?.order) : 9999,
      isActive: typeof x?.isActive === "boolean" ? x.isActive : true,
    };
  });

  // nur aktive Kriterien für Score/Overall (du kannst das ändern, wenn du inactive trotzdem zeigen willst)
  return arr
    .filter((c) => c.isActive !== false)
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const publicSlug = String(searchParams.get("publicSlug") ?? "").trim();

    if (!publicSlug) {
      return NextResponse.json({ ok: false, error: "Missing publicSlug" }, { status: 400 });
    }

    const tastingDoc = await getTastingBySlug(publicSlug);
    if (!tastingDoc) {
      return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });
    }

    const tasting = tastingDoc.data() as any;
    const tastingRef = tastingDoc.ref;

    const wineCount = Number(tasting?.wineCount ?? 0) || 0;
    const status = String(tasting?.status ?? "").trim() || null;

    const criteria = await getCriteria(tastingRef);

    // Ratings laden (collection: tastings/{id}/ratings)
    const ratingsSnap = await tastingRef.collection("ratings").get();
    const ratings: RatingDoc[] = ratingsSnap.docs.map((d) => (d.data() ?? {}) as RatingDoc);
    const ratingCount = ratingsSnap.size;

    // Aggregation: sums[blindNumber][criterionId] = { sum, count }
    const sums = new Map<number, Map<string, { sum: number; count: number }>>();

    for (const r of ratings) {
      const bn = Number(r?.blindNumber);
      if (!Number.isFinite(bn) || bn < 1) continue;

      const scoreObj = r?.scores ?? {};
      if (!scoreObj || typeof scoreObj !== "object") continue;

      let wineMap = sums.get(bn);
      if (!wineMap) {
        wineMap = new Map();
        sums.set(bn, wineMap);
      }

      for (const c of criteria) {
        const v = num((scoreObj as any)[c.id]); // ✅ KEY = criterionId
        if (v == null) continue;

        const cur = wineMap.get(c.id) ?? { sum: 0, count: 0 };
        cur.sum += v;
        cur.count += 1;
        wineMap.set(c.id, cur);
      }
    }

    // Rows für 1..wineCount
    const rows = Array.from({ length: wineCount }, (_, i) => {
      const blindNumber = i + 1;
      const wineMap = sums.get(blindNumber);

      const perCrit: Record<string, number | null> = {};
      let overallSum = 0;
      let overallCount = 0;

      for (const c of criteria) {
        const cell = wineMap?.get(c.id);
        const avg = cell && cell.count > 0 ? cell.sum / cell.count : null;
        perCrit[c.id] = avg;

        if (avg != null) {
          overallSum += avg;
          overallCount += 1;
        }
      }

      const overall = overallCount > 0 ? overallSum / overallCount : null;

      return { blindNumber, perCrit, overall };
    });

    // Ranking: nur Weine mit overall
    const ranking = rows
      .slice()
      .filter((r) => typeof r.blindNumber === "number")
      .sort((a, b) => {
        const ao = a.overall;
        const bo = b.overall;
        if (ao == null && bo == null) return a.blindNumber - b.blindNumber;
        if (ao == null) return 1;
        if (bo == null) return -1;
        return bo - ao;
      });

    return NextResponse.json({
      ok: true,
      publicSlug,
      tastingId: tastingDoc.id,
      status,
      wineCount,
      criteria: criteria.map((c) => ({ id: c.id, label: c.label, order: c.order })),
      rows,
      ranking,
      ratingCount,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
