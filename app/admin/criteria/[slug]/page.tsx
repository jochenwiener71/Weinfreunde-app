import Link from "next/link";

export default async function AdminCriteriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin · Kategorien/Kriterien verwalten</h1>
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
      </div>

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Auch das ist erstmal nur, damit die Route existiert. Danach können wir die echte Criteria-CRUD Logik reinbauen.
      </p>
    </main>
  );
}
