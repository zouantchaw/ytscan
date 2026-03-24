import { redirect } from "next/navigation";

type ChannelComparePickerPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ChannelComparePickerPage({
  params,
}: ChannelComparePickerPageProps) {
  const { slug } = await params;
  redirect(`/app/channels/${slug}`);
}
