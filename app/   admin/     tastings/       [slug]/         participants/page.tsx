// app/admin/tastings/[slug]/participants/page.tsx
import ParticipantsClient from "./ParticipantsClient";

export default function Page({ params }: { params: { slug: string } }) {
  return <ParticipantsClient slug={decodeURIComponent(params.slug)} />;
}
