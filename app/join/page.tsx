import JoinClient from "./JoinClient";

export default function JoinPage({
  searchParams,
}: {
  searchParams?: { slug?: string };
}) {
  const slug = String(searchParams?.slug ?? "").trim();

  return <JoinClient initialSlug={slug} />;
}
