import { Suspense } from "react";
import AdminCreateClient from "./AdminCreateClient";

export const dynamic = "force-dynamic";

export default function AdminCreatePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Lade…</div>}>
      <AdminCreateClient />
    </Suspense>
  );
}
