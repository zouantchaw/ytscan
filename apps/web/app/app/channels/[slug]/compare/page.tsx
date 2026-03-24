import { redirect } from "next/navigation";

type ChannelComparePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ChannelComparePage({
  params,
}: ChannelComparePageProps) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
