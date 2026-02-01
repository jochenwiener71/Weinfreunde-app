import { Suspense } from "react";
import JoinClient from "./join-client";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Lade…</div>}>
      <JoinClient />
    </Suspense>
  );
}
