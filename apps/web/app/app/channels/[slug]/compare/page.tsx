import { redirect } from "next/navigation";

export default async function LegacyChannelComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
