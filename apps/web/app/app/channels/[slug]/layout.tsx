"use client";

import Link from "next/link";
import type { ChannelDashboard } from "@ytscan/core";
import { useParams, usePathname } from "next/navigation";
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

  if (!needsChannelLabel) {
    return children;
  }

  return (
    <div className="space-y-4">
      <div className="app-page">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <Link href={`/app/channels/${slug}`} className="font-medium text-foreground hover:text-primary">
            {channelName}
          </Link>
          <span>/</span>
          {isHookRoute ? (
            <>
              <span>Analytics</span>
              <span>/</span>
              <span className="font-medium text-foreground">Hook Library</span>
            </>
          ) : (
            <span className="font-medium text-foreground">Video Detail</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
