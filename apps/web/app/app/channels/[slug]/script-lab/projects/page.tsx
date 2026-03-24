import { redirect } from "next/navigation";

type ChannelScriptProjectsPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ChannelScriptProjectsPage({
  params,
}: ChannelScriptProjectsPageProps) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
