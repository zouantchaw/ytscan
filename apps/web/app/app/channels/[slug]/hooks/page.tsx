import { redirect } from "next/navigation";

type LegacyChannelHooksPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LegacyChannelHooksPage({
  params,
}: LegacyChannelHooksPageProps) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}/videos`);
}
