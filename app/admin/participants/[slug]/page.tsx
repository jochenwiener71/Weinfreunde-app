import ParticipantsClient from "./ParticipantsClient";

export default function Page({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params?.slug ?? "";
  return <ParticipantsClient slug={slug} />;
}
