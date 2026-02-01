import { Suspense } from "react";
import JoinClient from "./JoinClient";

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Lade…</div>}>
      <JoinClient />
    </Suspense>
  );
}
