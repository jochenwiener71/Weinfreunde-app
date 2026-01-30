import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebaseAdmin";
import { hashPin } from "../../../../lib/security";

type RatingDoc = {
  blindNumber: number;
  scores: Record<string, number>; // { "Nase": 7, "Gaumen": 8, ... }
  createdAt?: any;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const publicSlug = String(body.publicSlug ?? "").trim();
  const pin = String(body.pin ?? "").trim();

  if (!publicSlug) return bad("publicSlug missing");
  if (!/^\d{4}$/.test(pin)) return bad("pin must be 4 digits");

  try {
    // 1) Tasting laden
    const q = await db()
      .collection("tastings")
      .where("publicSlug", "==", publicSlug)
      .limit(1)
      .get();

    if (q.empty) return bad("Tasting not found", 404);

    const tDoc = q.docs[0];
    const tasting = tDoc.data() as any;

    // 2) PIN prüfen
    const expectedHash = String(tasting.pinHash ?? "");
    const providedHash = hashPin(pin);

    if (!expectedHash || providedHash !== expectedHash) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Wines laden (für Reihenfolge)
    const winesSnap = await tDoc.ref.collection("wines").get();
    const wines = winesSnap.docs
      .map((d) => d.data() as any)
      .filter((w) => Number.isFinite(w.blindNumber))
      .sort((a, b) => Number(a.blindNumber) - Number(b.blindNumber));

    // 4) Ratings laden
    // Erwartete Struktur: tastings/{tId}/ratings/{doc}
    // doc: { blindNumber: number, scores: { [label]: number } }
    const ratingsSnap = await tDoc.ref.collection("ratings").get();
    const ratings: RatingDoc[] = ratingsSnap.docs
      .map((d) => d.data() as any)
      .filter((r) => Number.isFinite(r.blindNumber) && r.scores && typeof r.scores === "object");

    // 5) Aggregation
    // Map blindNumber -> criterionLabel -> { sum, n }
    const agg: Record<number, Record<string, { sum: number; n: number }>> = {};

    for (const r of ratings) {
      const bn = Number(r.blindNumber);
      agg[bn] ||= {};

      for (const [label, value] of Object.entries(r.scores || {})) {
        const v = Number(value);
        if (!Number.isFinite(v)) continue;

        agg[bn][label] ||= { sum: 0, n: 0 };
        agg[bn][label].sum += v;
        agg[bn][label].n += 1;
      }
    }

    // 6) Build summary rows
    const rows = wines.map((w: any) => {
      const bn = Number(w.blindNumber);
      const byCrit = agg[bn] || {};
      const criteria = Object.entries(byCrit).reduce((acc, [label, s]) => {
        acc[label] = s.n ? Number((s.sum / s.n).toFixed(2)) : null;
        return acc;
      }, {} as Record<string, number | null>);

      // Gesamt = Ø über vorhandene Kriterien
      const vals = Object.values(criteria).filter((x): x is number => typeof x === "number");
      const total = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;

      return {
        blindNumber: bn,
        criteria,
        total,
      };
    });

    // 7) Ranking
    const ranking = [...rows]
      .filter((r) => typeof r.total === "number")
      .sort((a, b) => (b.total as number) - (a.total as number))
      .map((r, idx) => ({
        rank: idx + 1,
        blindNumber: r.blindNumber,
        total: r.total,
      }));

    return NextResponse.json({
      ok: true,
      publicSlug,
      status: tasting.status ?? null,
      counts: {
        wines: wines.length,
        ratings: ratings.length,
      },
      rows,
      ranking,
      note:
        ratings.length === 0
          ? "No ratings found. Expected Firestore path: tastings/{tastingId}/ratings with fields {blindNumber, scores:{...}}"
          : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Summary failed" },
      { status: 500 }
    );
  }
}
