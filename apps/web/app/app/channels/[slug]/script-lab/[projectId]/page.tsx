import { redirect } from "next/navigation";

export default async function LegacyChannelScriptProjectPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
