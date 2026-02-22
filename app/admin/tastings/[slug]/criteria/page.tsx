// app/admin/tastings/[slug]/criteria/page.tsx
import CriteriaClient from "./CriteriaClient";

export default function Page({ params }: { params: { slug: string } }) {
  return <CriteriaClient slug={decodeURIComponent(params.slug)} />;
}
