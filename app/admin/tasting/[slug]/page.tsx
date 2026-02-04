import Link from "next/link";

export default async function AdminTastingManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Tasting verwalten</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        publicSlug: <b>{slug}</b>
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <Link
          href={`/admin/wines`}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none" }}
        >
          🍷 Weine verwalten
        </Link>

        <Link
          href={`/admin/reporting`}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none" }}
        >
          📊 Reporting
        </Link>

        <Link
          href={`/reporting/${encodeURIComponent(slug)}`}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none" }}
        >
          🔎 Public Reporting öffnen
        </Link>
      </div>

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Hinweis: Das ist erstmal eine “Landing”-Seite, damit die Route existiert (kein 404). Wenn du willst, bauen wir hier
        später echte Tasting-Settings (Status open/revealed, maxParticipants, etc.).
      </p>
    </main>
  );
}
