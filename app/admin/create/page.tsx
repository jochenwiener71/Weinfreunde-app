import { Suspense } from "react";
import AdminCreateClient from "./AdminCreateClient";

export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 24, fontFamily: "system-ui" }}>Lade…</main>}>
      <AdminCreateClient />
    </Suspense>
  );
}
