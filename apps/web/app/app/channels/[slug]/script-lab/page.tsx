import { redirect } from "next/navigation";

export default async function LegacyChannelScriptLabPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
