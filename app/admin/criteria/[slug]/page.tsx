import CriteriaClient from "./CriteriaClient";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CriteriaClient slug={slug} />;
}
