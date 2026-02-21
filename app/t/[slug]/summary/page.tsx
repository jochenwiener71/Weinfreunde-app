// app/t/[slug]/summary/page.tsx

import { db } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

export const runtime = "nodejs";

interface Params {
  params: { slug: string };
}

export default async function SummaryPage({ params }: Params) {
  const slug = params.slug;

  const tq = await db()
    .collection("tastings")
    .where("publicSlug", "==", slug)
    .limit(1)
    .get();

  if (tq.empty) {
    return <div>Tasting nicht gefunden</div>;
  }

  const tastingDoc = tq.docs[0];

  const winesSnap = await tastingDoc.ref
    .collection("wines")
    .orderBy("blindNumber")
    .get();

  const wines = winesSnap.docs.map(d => ({
    id: d.id,
    ...(d.data() as any),
  }));

  const ratingsSnap = await tastingDoc.ref
    .collection("ratings")
    .get();

  const ratings = ratingsSnap.docs.map(d => d.data());

  return (
    <main style={{ padding: 40 }}>
      <h1>Ergebnis</h1>

      {wines.map((wine: any) => {
        const wineRatings = ratings.filter((r: any) => r.wineId === wine.id);

        const avg =
          wineRatings.length > 0
            ? (
                wineRatings.reduce(
                  (sum: number, r: any) => sum + Number(r.total ?? 0),
                  0
                ) / wineRatings.length
              ).toFixed(2)
            : "-";

        return (
          <section key={wine.id} style={{ marginBottom: 30 }}>
            <h2>Wein #{wine.blindNumber}</h2>
            <p>Durchschnitt: {avg}</p>

            <ul>
              {wineRatings.map((r: any, i: number) => (
                <li key={i}>
                  {r.participantName}: {r.total}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
