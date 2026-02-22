import ParticipantsClient from "./ParticipantsClient";

export default function Page({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  return <ParticipantsClient slug={slug} />;
}
