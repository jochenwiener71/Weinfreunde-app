import Link from "next/link";

export default async function AdminParticipantsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Teilnehmer verwalten</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        publicSlug: <b>{slug}</b>
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <Link
          href={`/admin`}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none" }}
        >
          ← Admin Dashboard
        </Link>

        <Link
          href={`/reporting/${encodeURIComponent(slug)}`}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", textDecoration: "none" }}
        >
          📊 Reporting (public)
        </Link>
      </div>

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Wenn du schon eine echte Teilnehmer-Seite hast (anderer Pfad), sag mir den Pfad – dann verlinken wir 1:1 korrekt.
      </p>
    </main>
  );
}
