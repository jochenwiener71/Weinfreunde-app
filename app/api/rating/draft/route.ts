import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";
import { requireSession } from "@/lib/session";

type ScoresMap = Record<string, number>;

async function getTastingBySlug(publicSlug: string) {
  const snap = await db()
    .collection("tastings")
    .where("publicSlug", "==", publicSlug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0]; // QueryDocumentSnapshot
}

export async function GET(req: Request) {
  try {
    const session = requireSession();

    const { searchParams } = new URL(req.url);
    const slug = String(searchParams.get("slug") ?? "").trim();
    const blindNumber = Number(searchParams.get("blindNumber") ?? "");

    if (!slug || !Number.isFinite(blindNumber) || blindNumber < 1) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }

    const tastingDoc = await getTastingBySlug(slug);
    if (!tastingDoc) return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });

    // Sicherheitscheck: Session muss zu diesem Tasting passen
    if (tastingDoc.id !== session.tastingId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const ref = tastingDoc.ref
      .collection("participants")
      .doc(session.participantId)
      .collection("drafts")
      .doc(String(blindNumber));

    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: true, draft: null });

    const d = snap.data() as any;
    return NextResponse.json({
      ok: true,
      draft: {
        scores: (d?.scores ?? {}) as ScoresMap,
        comment: typeof d?.comment === "string" ? d.comment : "",
        updatedAt: d?.updatedAt ?? null,
      },
    });
  } catch (e: any) {
    const msg = e?.message ?? "Error";
    const status = msg === "Not logged in" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = requireSession();

    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug ?? "").trim();
    const blindNumber = Number(body?.blindNumber ?? "");
    const scores = (body?.scores ?? {}) as ScoresMap;
    const comment = String(body?.comment ?? "");

    if (!slug || !Number.isFinite(blindNumber) || blindNumber < 1) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }

    const tastingDoc = await getTastingBySlug(slug);
    if (!tastingDoc) return NextResponse.json({ ok: false, error: "Tasting not found" }, { status: 404 });

    if (tastingDoc.id !== session.tastingId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const ref = tastingDoc.ref
      .collection("participants")
      .doc(session.participantId)
      .collection("drafts")
      .doc(String(blindNumber));

    await ref.set(
      {
        scores: scores && typeof scores === "object" ? scores : {},
        comment,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? "Error";
    const status = msg === "Not logged in" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
