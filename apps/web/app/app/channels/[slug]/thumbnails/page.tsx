import { redirect } from "next/navigation";

type LegacyChannelThumbnailsPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LegacyChannelThumbnailsPage({
  params,
}: LegacyChannelThumbnailsPageProps) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}/videos`);
}
