"use client";

import Link from "next/link";
import type { ChannelDashboard, ChannelSummary } from "@ytscan/core";
import { AppTopNav } from "@/components/app/app-top-nav";
import {
  AppPanel,
  ChannelAvatar,
  EmptyState,
  PageLoading,
} from "@/components/app/app-ui";
import { useBackendQuery } from "@/lib/backend-client";
import {
  formatCompactNumber,
  formatPercent,
  formatSignedRatio,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { getChannelHeaderTone } from "@/lib/channel-ui";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

function ChannelSelectorCard({ channel }: { channel: ChannelSummary }) {
  const dashboard = useBackendQuery<ChannelDashboard>(
    `/channels/${encodeURIComponent(channel.slug)}`
  );

  const averageViews = dashboard.data
    ? formatCompactNumber(dashboard.data.averageViews)
    : "—";
  const engagementRate = dashboard.data
    ? formatPercent(dashboard.data.averageEngagementRate)
    : "—";
  const growth = dashboard.data
    ? formatSignedRatio(dashboard.data.stats.averageViews.deltaPct)
    : "—";
  const growthTone =
    (dashboard.data?.stats.averageViews.delta ?? 0) >= 0
      ? "text-success"
      : "text-destructive";

  return (
    <Link href={`/app/channels/${channel.slug}`} className="block">
      <AppPanel className="overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
        <div
          className={cn(
            "flex items-center gap-4 px-6 py-6 text-white",
            getChannelHeaderTone(channel.slug)
          )}
        >
          <ChannelAvatar channelName={channel.channelName} channelSlug={channel.slug} />
          <div className="space-y-1">
            <p className="font-display text-[18px] font-semibold tracking-[-0.03em]">
              {channel.channelName}
            </p>
            <p className="text-sm text-white/62">{channel.totalVideos} videos scanned</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 px-6 py-5">
          <div className="space-y-1">
            <p className="font-display text-[24px] font-semibold tracking-[-0.04em] text-foreground">
              {averageViews}
            </p>
            <p className="text-sm text-muted-foreground">Avg. views</p>
          </div>
          <div className="space-y-1">
            <p className="font-display text-[24px] font-semibold tracking-[-0.04em] text-foreground">
              {engagementRate}
            </p>
            <p className="text-sm text-muted-foreground">Eng. rate</p>
          </div>
          <div className="space-y-1">
            <p className={cn("font-display text-[24px] font-semibold tracking-[-0.04em]", growthTone)}>
              {growth}
            </p>
            <p className="text-sm text-muted-foreground">Growth</p>
          </div>
        </div>
      </AppPanel>
    </Link>
  );
}

export default function ChannelSelectorPage() {
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");

  return (
    <div className="min-h-screen bg-background">
      <AppTopNav />
      <main className="app-page py-10">
        <section className="space-y-8">
          <div className="space-y-2">
            <h1 className="font-display text-[48px] font-semibold tracking-[-0.05em] text-foreground">
              Your Channels
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              Select a channel to view its dashboard, or scan a new one.
            </p>
          </div>

          {channels.isLoading ? (
            <PageLoading />
          ) : channels.data?.items.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {channels.data.items.map((channel) => (
                <ChannelSelectorCard key={channel.slug} channel={channel} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No channels yet"
              description="Start by scanning a YouTube channel. Once the ingest job completes, it will appear here."
              actionLabel="+ Scan New Channel"
              actionHref="/app/scans/new"
            />
          )}
        </section>
      </main>
    </div>
  );
}
