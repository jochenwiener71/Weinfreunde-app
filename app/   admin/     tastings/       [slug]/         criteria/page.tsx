// app/admin/tastings/[slug]/criteria/page.tsx
import Link from "next/link";

export default function Page({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Kategorien</h1>
      <p style={{ marginTop: 6, opacity: 0.8 }}>
        publicSlug: <b>{slug}</b>
      </p>

      <div style={{ marginTop: 12 }}>
        <Link href={`/admin/tastings/${encodeURIComponent(slug)}/participants`}>
          ← Teilnehmer
        </Link>
      </div>

      <p style={{ marginTop: 14, opacity: 0.7 }}>
        (Platzhalter) — Wenn du mir deinen CriteriaClient Code gibst, hänge ich ihn hier 1:1 sauber rein.
      </p>
    </main>
  );
}
