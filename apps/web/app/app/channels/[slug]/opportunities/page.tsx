import { redirect } from "next/navigation";

type ChannelOpportunitiesPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ChannelOpportunitiesPage({
  params,
}: ChannelOpportunitiesPageProps) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
