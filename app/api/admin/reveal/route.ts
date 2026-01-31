import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

function pickProvidedSecret(req: Request): { value: string; source: string } {
  const header =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  if (header && header.trim()) return { value: header.trim(), source: "header:x-admin-secret" };

  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return { value: token, source: "header:authorization(bearer)" };
  }

  return { value: "", source: "none" };
}

function esc(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlPage(title: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;line-height:1.35}
    h1{margin:0 0 8px}
    .card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;max-width:900px}
    .row{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0}
    code,pre{background:#f6f8fa;border:1px solid #e5e7eb;border-radius:8px;padding:2px 6px}
    pre{padding:12px;overflow:auto}
    .ok{color:#065f46;font-weight:700}
    .bad{color:#b91c1c;font-weight:700}
    .muted{color:#6b7280}
    a{color:#2563eb}
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <div class="card">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function requireEnvOrExplain(name: string) {
  const v = String(process.env[name] ?? "").trim();
  return v ? { ok: true as const, value: v } : { ok: false as const, value: "" };
}

/**
 * REVEAL endpoint
 * - GET: HTML UI (Form), damit du es im Browser testen kannst
 * - POST: führt Reveal aus (status => revealed)
 *
 * Parameter:
 * - tastingId   (oder)
 * - publicSlug  (fallback)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tastingId = url.searchParams.get("tastingId") ?? "";
  const publicSlug = url.searchParams.get("publicSlug") ?? "";

  const body = `
    <p class="muted">
      Setzt den Status eines Tastings auf <code>revealed</code>.
      Du kannst per <code>tastingId</code> oder <code>publicSlug</code> arbeiten.
    </p>

    <form method="post" action="/api/admin/reveal">
      <div class="row">
        <label style="min-width: 260px;">
          Admin Secret (wird nur im Browser genutzt)<br/>
          <input name="adminSecret" type="password" style="width:260px;padding:10px;border:1px solid #e5e7eb;border-radius:10px" />
        </label>
      </div>

      <div class="row">
        <label style="min-width: 260px;">
          tastingId<br/>
          <input name="tastingId" value="${esc(tastingId)}" placeholder="z.B. G8tsMYvrPeisf40HCpCI"
            style="width:420px;padding:10px;border:1px solid #e5e7eb;border-radius:10px" />
        </label>
      </div>

      <div class="row">
        <label style="min-width: 260px;">
          publicSlug (Fallback, wenn tastingId leer)<br/>
          <input name="publicSlug" value="${esc(publicSlug)}" placeholder="z.B. weinfreunde"
            style="width:420px;padding:10px;border:1px solid #e5e7eb;border-radius:10px" />
        </label>
      </div>

      <div class="row">
        <button type="submit" style="padding:10px 14px;border:1px solid #111827;border-radius:10px;background:#111827;color:white;cursor:pointer">
          Reveal ausführen
        </button>
      </div>

      <p class="muted">
        Alternativ per Fetch: <code>POST /api/admin/reveal</code> mit Header <code>x-admin-secret</code> und JSON Body.
      </p>
    </form>
  `;

  return new NextResponse(htmlPage("Admin · Reveal (Status → revealed)", body), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  // --- Admin Secret Check ---
  const expected = requireEnvOrExplain("ADMIN_SECRET");
  if (!expected.ok) {
    const body = `<p class="bad">ADMIN_SECRET fehlt in dieser Deployment-Umgebung.</p>
      <p class="muted">Setze <code>ADMIN_SECRET</code> in Vercel (Production) und redeploye.</p>`;
    return new NextResponse(htmlPage("Reveal · Fehler", body), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Body kann FormData (vom Browser-Form) oder JSON sein
  let tastingId = "";
  let publicSlug = "";
  let adminSecretFromBody = "";

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    tastingId = String(form.get("tastingId") ?? "").trim();
    publicSlug = String(form.get("publicSlug") ?? "").trim();
    adminSecretFromBody = String(form.get("adminSecret") ?? "").trim();
  } else {
    let bodyJson: any = {};
    try {
      bodyJson = await req.json().catch(() => ({}));
    } catch {
      bodyJson = {};
    }
    tastingId = String(bodyJson.tastingId ?? "").trim();
    publicSlug = String(bodyJson.publicSlug ?? "").trim();
    adminSecretFromBody = String(bodyJson.adminSecret ?? "").trim();
  }

  const provided = pickProvidedSecret(req);
  const providedSecret = (provided.value || adminSecretFromBody || "").trim();

  if (!providedSecret || providedSecret !== expected.value) {
    const body = `<p class="bad">Forbidden</p>
      <p class="muted">Admin Secret fehlt oder stimmt nicht.</p>
      <pre>${esc(JSON.stringify({
        expectedSet: true,
        providedSource: provided.value ? provided.source : (adminSecretFromBody ? "body:adminSecret" : "none"),
        providedLength: providedSecret.length,
      }, null, 2))}</pre>`;
    return new NextResponse(htmlPage("Reveal · Forbidden", body), {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!tastingId && !publicSlug) {
    const body = `<p class="bad">Fehlende Parameter</p>
      <p class="muted">Bitte <code>tastingId</code> oder <code>publicSlug</code> angeben.</p>`;
    return new NextResponse(htmlPage("Reveal · Fehler", body), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    // --- Resolve tasting doc ---
    let tRef: FirebaseFirestore.DocumentReference;

    if (tastingId) {
      tRef = db().collection("tastings").doc(tastingId);
      const snap = await tRef.get();
      if (!snap.exists) {
        const body = `<p class="bad">Not found</p>
          <p class="muted">Kein Tasting mit <code>tastingId=${esc(tastingId)}</code>.</p>`;
        return new NextResponse(htmlPage("Reveal · Not found", body), {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    } else {
      const q = await db()
        .collection("tastings")
        .where("publicSlug", "==", publicSlug)
        .limit(1)
        .get();

      if (q.empty) {
        const body = `<p class="bad">Not found</p>
          <p class="muted">Kein Tasting mit <code>publicSlug=${esc(publicSlug)}</code>.</p>`;
        return new NextResponse(htmlPage("Reveal · Not found", body), {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      tRef = q.docs[0].ref;
      tastingId = q.docs[0].id;
    }

    // --- Update status ---
    const now = admin.firestore.FieldValue.serverTimestamp();
    await tRef.set({ status: "revealed", updatedAt: now }, { merge: true });

    const body = `
      <p class="ok">✅ Reveal erfolgreich</p>
      <div class="row">
        <div>Tasting ID: <code>${esc(tastingId)}</code></div>
      </div>
      <div class="row">
        <div>Neuer Status: <code>revealed</code></div>
      </div>
      <p class="muted">
        Tipp: Du kannst diese Seite als “Button” nutzen: oben im Browser URL + Parameter.
      </p>
      <pre>${esc(JSON.stringify({ ok: true, tastingId, status: "revealed" }, null, 2))}</pre>
    `;

    return new NextResponse(htmlPage("Reveal · OK", body), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    const body = `<p class="bad">❌ Reveal fehlgeschlagen</p>
      <pre>${esc(e?.message ?? String(e))}</pre>`;
    return new NextResponse(htmlPage("Reveal · Fehler", body), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
