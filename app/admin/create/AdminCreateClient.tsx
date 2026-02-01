"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * HIER kommt dein bisheriger Code aus page.tsx rein
 * inkl. useSearchParams()
 */
export default function AdminCreateClient() {
  const searchParams = useSearchParams();

  const [publicSlug, setPublicSlug] = useState("");

  // Beispiel: ?publicSlug=weinfreunde
  useEffect(() => {
    const slug = searchParams.get("publicSlug");
    if (slug) setPublicSlug(slug);
  }, [searchParams]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>Admin · Tasting erstellen</h1>

      <label>
        publicSlug (vorbefüllt)
        <input
          value={publicSlug}
          onChange={(e) => setPublicSlug(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </label>

      {/* 🔽 HIER einfach den REST deines bisherigen Create-Forms einfügen */}
    </main>
  );
}
