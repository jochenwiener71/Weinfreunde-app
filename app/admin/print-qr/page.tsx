import { Suspense } from "react";
import PrintQrClient from "./print-qr-client";

export const dynamic = "force-dynamic";

export default function PrintQrPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Lade QR-Code…</div>}>
      <PrintQrClient />
    </Suspense>
  );
}
