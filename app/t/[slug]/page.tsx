"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type CheckResp =
  | { ok: true; session: any }
  | { ok: false; error?: string };

export default function TastingSlugLandingPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  const slug = useMemo(() => String(params?.slug ?? "").trim(), [params]);

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  // Overlay state
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkSession() {
    setChecking(true);
    setError(null);

    try {
      const res = await fetch("/api/session/check", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as CheckResp;

      if (res.ok && data && (data as any).ok === true) {
        setLoggedIn(true);
        setOverlayOpen(false);
      } else {
        setLoggedIn(false);
        setOverlayOpen(true);
      }
    } catch (e: any) {
      setLoggedIn(false);
      setOverlayOpen(true);
      setError(e?.message ?? "Session check failed");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function submitJoin() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug,
          name: name.trim(),
          pin: pin.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(String(data?.error ?? "Login failed"));
        return;
      }

      // ✅ Cookie gesetzt -> Session neu prüfen und dann weiter
      await checkSession();

      // Direkt zur Bewertung (Wein #1)
      window.location.href = `/t/${encodeURIComponent(slug)}/wine/1`;
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Wenn eingeloggt: direkt zu Wein #1
  useEffect(() => {
    if (checking) return;
    if (!loggedIn) return;

    router.replace(`/t/${encodeURIComponent(slug)}/wine/1`);
  }, [checking, loggedIn, router, slug]);

  return (
    <main className="min-h-[100svh] w-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-2xl">
          <div className="text-white/90 text-lg font-semibold">
            🍷 {slug || "Tasting"}
          </div>
          <div className="mt-2 text-white/60 text-sm">
            {checking
              ? "Session wird geprüft …"
              : loggedIn
              ? "Eingeloggt – leite zur Bewertung …"
              : "Nicht eingeloggt – bitte Name + PIN eingeben."}
          </div>
        </div>
      </div>

      {/* Login Overlay */}
      {overlayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" />

          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white text-xl font-semibold">Einloggen</div>
                <div className="mt-1 text-white/60 text-sm">
                  Bitte gib deinen Namen und die 4-stellige PIN ein.
                </div>
              </div>

              <button
                onClick={() => setOverlayOpen(false)}
                className="text-white/70 hover:text-white text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-white/70 text-sm mb-1">
                  Runde (Slug)
                </label>
                <input
                  value={slug}
                  readOnly
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white/80 outline-none"
                />
              </div>

              <div>
                <label className="block text-white/70 text-sm mb-1">
                  Dein Vorname
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  placeholder="z.B. Jochen"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-white/70 text-sm mb-1">
                  PIN (4-stellig)
                </label>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1234"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/30"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={submitJoin}
                disabled={
                  submitting || !slug || name.trim().length < 1 || pin.trim().length < 4
                }
                className="mt-2 w-full rounded-xl bg-red-600/90 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-600/90 text-white font-semibold py-3 transition"
              >
                {submitting ? "Bitte warten …" : "Beitreten"}
              </button>

              <div className="mt-2 text-white/50 text-xs">
                Tipp: Wenn du über den QR-Code kommst, bist du direkt in der richtigen Runde.
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
