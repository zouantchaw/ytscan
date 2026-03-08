"use client";

import type { ChannelDashboard } from "@ytscan/core";
import { useParams, usePathname } from "next/navigation";
import { AppTopNav } from "@/components/app/app-top-nav";
import { useBackendQuery } from "@/lib/backend-client";
import { prettifyChannelSlug } from "@/lib/channel-ui";

type ChannelLayoutProps = {
  children: React.ReactNode;
};

export default function ChannelLayout({ children }: ChannelLayoutProps) {
  const params = useParams<{ slug: string }>();
  const pathname = usePathname();
  const slug = params.slug;
  const isHookRoute = pathname?.includes("/hooks") ?? false;
  const isVideoRoute = pathname?.includes("/videos/") ?? false;
  const needsChannelLabel = isHookRoute || isVideoRoute;
  const channel = useBackendQuery<ChannelDashboard>(
    needsChannelLabel ? `/channels/${encodeURIComponent(slug)}` : null,
    { enabled: needsChannelLabel }
  );
  const channelName = channel.data?.channelName ?? prettifyChannelSlug(slug);

  return (
    <div className="min-h-screen bg-background">
      {isHookRoute ? (
        <AppTopNav breadcrumbs={[channelName, "Dashboard", "Hook Library"]} />
      ) : isVideoRoute ? (
        <AppTopNav
          breadcrumbs={[channelName, "Video Detail"]}
          rightHref={`/app/channels/${slug}`}
          rightLabel="Back to Dashboard"
        />
      ) : (
        <AppTopNav channelSlug={slug} showTabs />
      )}
      {children}
    </div>
  );
}
