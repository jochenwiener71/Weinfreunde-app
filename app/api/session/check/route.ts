import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, session });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Session check failed" },
      { status: 500 }
    );
  }
}
