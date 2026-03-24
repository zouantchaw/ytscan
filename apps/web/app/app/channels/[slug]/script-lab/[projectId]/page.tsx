import { redirect } from "next/navigation";

type ChannelScriptProjectPageProps = {
  params: Promise<{ slug: string; projectId: string }>;
};

export default async function ChannelScriptProjectPage({
  params,
}: ChannelScriptProjectPageProps) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
