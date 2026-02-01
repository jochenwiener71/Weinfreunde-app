import { Suspense } from "react";
import AdminCreateClient from "./AdminCreateClient";

export default function AdminCreatePage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Lade…</div>}>
      <AdminCreateClient />
    </Suspense>
  );
}
