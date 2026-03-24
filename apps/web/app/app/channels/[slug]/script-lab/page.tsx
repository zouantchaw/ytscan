import { redirect } from "next/navigation";

type ChannelScriptLabPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ChannelScriptLabPage({
  params,
}: ChannelScriptLabPageProps) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
