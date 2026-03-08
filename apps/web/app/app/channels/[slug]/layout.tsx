import { AppTopNav } from "@/components/app/app-top-nav";

type ChannelLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function ChannelLayout({
  children,
  params,
}: ChannelLayoutProps) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-background">
      <AppTopNav channelSlug={slug} showTabs />
      {children}
    </div>
  );
}
