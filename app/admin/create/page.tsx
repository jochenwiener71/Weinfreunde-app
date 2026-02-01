import { Suspense } from "react";
import AdminCreateTastingClient from "./AdminCreateTastingClient";

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 24, fontFamily: "system-ui" }}>Lade…</main>}>
      <AdminCreateTastingClient />
    </Suspense>
  );
}
