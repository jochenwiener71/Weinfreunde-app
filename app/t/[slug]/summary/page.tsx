import crypto from "crypto";

/**
 * Hash a 4-digit PIN using server-side salt
 */
export function hashPin(pin: string): string {
  const salt = process.env.PIN_SALT ?? "";
  return crypto
    .createHash("sha256")
    .update(`${pin}:${salt}`)
    .digest("hex");
}

/**
 * Verify a plain PIN against a stored hash
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;
  const computed = hashPin(pin);
  return crypto.timingSafeEqual(
    Buffer.from(computed, "utf8"),
    Buffer.from(storedHash, "utf8")
  );
}

/**
 * Require ADMIN_SECRET (throws on failure)
 */
export function requireAdminSecret(req: Request) {
  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  if (!expected) {
    throw new Error("ADMIN_SECRET not configured");
  }

  const header =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  const auth = req.headers.get("authorization") || "";
  let provided = header;

  if (!provided && auth.toLowerCase().startsWith("bearer ")) {
    provided = auth.slice(7).trim();
  }

  if (!provided || provided !== expected) {
    throw new Error("Forbidden");
  }
}
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Ergebnisse · {data.publicSlug}</h1>
          <p style={{ marginTop: 0, opacity: 0.75 }}>
            Status: <b>{data.status}</b> · Ratings: <b>{data.ratingCount ?? 0}</b>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={`/t/${encodeURIComponent(slug)}`}
            style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, textDecoration: "none" }}
          >
            ↩︎ Zur Tasting-Seite
          </a>
          <a
            href={`/t/${encodeURIComponent(slug)}/results`}
            style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, textDecoration: "none" }}
          >
            🔄 Refresh
          </a>
        </div>
      </header>

      {data.status !== "revealed" && (
        <section style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "rgba(255,193,7,0.2)" }}>
          <b>Noch nicht aufgedeckt.</b>
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            Sobald du den Status auf <code>revealed</code> setzt (Reveal-Endpoint), erscheinen hier Ranking & Auswertung.
          </div>
        </section>
      )}

      {data.status === "revealed" && (
        <>
          {/* Ranking */}
          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>🏆 Ranking (nach Gesamtschnitt)</h2>

            {ranking.length === 0 ? (
              <p style={{ opacity: 0.8 }}>Noch keine vollständigen Ratings gefunden.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {ranking.map((r, idx) => (
                  <li key={r.blindNumber} style={{ marginBottom: 6 }}>
                    <b>Wein {r.blindNumber}</b> – Gesamtschnitt: <b>{fmt(r.overall)}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Detail-Tabelle */}
          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>📊 Detail (Ø pro Kriterium)</h2>

            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>Wein</th>
                    {criteria.map((c) => (
                      <th key={c.id} style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        {c.label}
                      </th>
                    ))}
                    <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      Gesamt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.blindNumber}>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                        <b>{r.blindNumber}</b>
                      </td>
                      {criteria.map((c) => (
                        <td key={c.id} style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                          {fmt(r.perCrit?.[c.label])}
                        </td>
                      ))}
                      <td style={{ textAlign: "right", padding: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                        <b>{fmt(r.overall)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Hinweis: Wenn Werte als „—“ erscheinen, fehlen für dieses Kriterium/Wein noch Ratings oder das Rating-Format passt nicht zu den erkannten Feldern (<code>scores</code>/<code>ratings</code>/<code>values</code>).
            </p>
          </section>
        </>
      )}
    </main>
  );
}
