import CriteriaClient from "./CriteriaClient";

export default async function AdminCriteriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CriteriaClient slug={slug} />;
}
