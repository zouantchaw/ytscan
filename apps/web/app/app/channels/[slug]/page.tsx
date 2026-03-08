"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTransition } from "react";
import type {
  ChannelDashboard,
  ChannelVideosResponse,
  HookSummary,
  TopicClusterSummary,
  VideoSummary,
} from "@ytscan/core";
import { AppPanel, ChannelAvatar, MetricCard, MetricDetail, TierBadge, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";
import { getChannelHandle } from "@/lib/channel-ui";
import {
  formatCompactNumber,
  formatDuration,
  formatPercent,
  formatRelativeDate,
  formatWeeklyRate,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

function DashboardBarChart({
  videos,
}: {
  videos: VideoSummary[];
}) {
  const ordered = [...videos].reverse();
  const maxViews = Math.max(...ordered.map((video) => video.viewCount), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
            Views Over Time
          </h2>
          <p className="text-sm text-muted-foreground">Last {ordered.length} uploads</p>
        </div>
        <div className="hidden items-center gap-1 rounded-[10px] bg-secondary p-1 md:flex">
          <span className="rounded-[8px] bg-card px-4 py-2 text-[13px] font-medium text-foreground">
            Views
          </span>
          <span className="px-4 py-2 text-[13px] text-muted-foreground">Likes</span>
          <span className="px-4 py-2 text-[13px] text-muted-foreground">Engagement</span>
        </div>
      </div>
      <div className="flex h-[430px] items-end gap-1 rounded-[8px]">
        {ordered.map((video) => {
          const ratio = video.viewCount / maxViews;
          const tone =
            video.performanceTier === "viral"
              ? "bg-primary"
              : video.performanceTier === "strong"
                ? "bg-[#D6D2CA]"
                : "bg-[#E9E7E2]";

          return (
            <div key={video.youtubeId} className="flex min-w-0 flex-1 items-end">
              <div
                className={cn("w-full rounded-t-[4px]", tone)}
                style={{ height: `${Math.max(48, ratio * 380)}px` }}
                title={`${video.title} · ${formatCompactNumber(video.viewCount)} views`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopPerformerRow({
  slug,
  video,
}: {
  slug: string;
  video: VideoSummary;
}) {
  return (
    <Link
      href={`/app/channels/${slug}/videos/${video.youtubeId}`}
      className="grid grid-cols-[72px_1fr_auto] items-center gap-4 border-b border-separator py-4 last:border-b-0 last:pb-0 first:pt-0"
    >
      <VideoThumbnail
        youtubeId={video.youtubeId}
        title={video.title}
        className="h-[42px] rounded-[8px] object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium text-foreground">{video.title}</p>
        <p className="text-sm text-muted-foreground">
          {formatCompactNumber(video.viewCount)} views · {formatDuration(video.durationSec)}
        </p>
      </div>
      <TierBadge tier={video.performanceTier} />
    </Link>
  );
}

function TopicClusterRow({ topic }: { topic: TopicClusterSummary }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4 text-[15px]">
        <span className="font-medium text-foreground">{topic.topic}</span>
        <span className="text-sm text-muted-foreground">{topic.videoCount} vids</span>
      </div>
      <div className="h-2 rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(8, topic.shareOfChannel * 100)}%` }}
        />
      </div>
    </div>
  );
}

function HookRow({ hook }: { hook: HookSummary }) {
  return (
    <div className="rounded-[8px] bg-background px-3 py-3">
      <p className="text-[15px] leading-7 text-foreground">
        &ldquo;{hook.text}&rdquo;
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="font-medium text-primary">{formatCompactNumber(hook.viewCount)} views</span>
        <span>{hook.hookType.replace(/_/g, " ")} hook</span>
      </div>
    </div>
  );
}

export default function ChannelDashboardPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const [isPending, startTransition] = useTransition();
  const dashboard = useBackendQuery<ChannelDashboard>(
    `/channels/${encodeURIComponent(slug)}`
  );
  const recentVideos = useBackendQuery<ChannelVideosResponse>(
    `/channels/${encodeURIComponent(slug)}/videos?limit=30&sort=recent`
  );

  async function handleRescan() {
    const currentChannel = dashboard.data;
    if (!currentChannel) return;

    startTransition(async () => {
      const response = await fetchBackend<{ job: { jobId: string } }>("/scan", {
        method: "POST",
        body: JSON.stringify({ channelUrl: currentChannel.channelUrl }),
      });
      router.push(`/app/scans/${response.job.jobId}`);
    });
  }

  if (dashboard.isLoading || !dashboard.data) {
    return (
      <main className="app-page py-8">
        <div className="grid gap-6">
          <AppPanel className="h-[108px]" />
          <div className="grid gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <AppPanel key={index} className="h-[120px]" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
            <AppPanel className="h-[547px]" />
            <AppPanel className="h-[547px]" />
          </div>
        </div>
      </main>
    );
  }

  const channel = dashboard.data;
  const averageViews = MetricDetail({
    metric: channel.stats.averageViews,
    type: "views",
  });
  const engagement = MetricDetail({
    metric: channel.stats.averageEngagementRate,
    type: "rate",
  });
  const cadence = MetricDetail({
    metric: channel.stats.uploadCadencePerWeek,
    type: "cadence",
  });
  const handle = getChannelHandle(channel.channelUrl, channel.slug);
  const scannedLabel = `Scanned ${formatRelativeDate(channel.scanDate)}`;
  const bestDurationLabel = channel.stats.bestDuration?.label ?? "No range";

  return (
    <main className="app-page py-8">
      <div className="grid gap-4">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <ChannelAvatar
              channelName={channel.channelName}
              channelSlug={channel.slug}
              size="lg"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[44px] font-semibold tracking-[-0.05em] text-foreground">
                  {channel.channelName}
                </h1>
              </div>
              <p className="text-[15px] text-muted-foreground">
                {handle} · {channel.totalVideos} videos ·{" "}
                {formatCompactNumber(channel.subscriberCount)} subscribers · {scannedLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              Export Report
            </Button>
            <Button variant="outline" onClick={handleRescan} disabled={isPending}>
              {isPending ? "Queueing..." : "Re-scan"}
            </Button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Avg Views"
            value={averageViews.value}
            detail={averageViews.detail}
            detailTone={averageViews.detailTone}
          />
          <MetricCard
            label="Engagement Rate"
            value={engagement.value}
            detail={
              channel.stats.averageEngagementRate.previous
                ? engagement.detail
                : `Above channel baseline (${formatPercent(channel.averageEngagementRate)})`
            }
            detailTone={engagement.detailTone}
          />
          <MetricCard
            label="Best Duration"
            value={bestDurationLabel}
            detail="Sweet spot for this channel"
          />
          <MetricCard
            label="Upload Cadence"
            value={formatWeeklyRate(channel.stats.uploadCadencePerWeek.current)}
            detail={cadence.detail}
            detailTone={cadence.detailTone}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <AppPanel className="px-6 py-6">
            <DashboardBarChart videos={recentVideos.data?.items ?? []} />
          </AppPanel>
          <AppPanel className="flex flex-col gap-4 px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                Top Performers
              </h2>
              <Link
                href={`/app/channels/${slug}/thumbnails`}
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                View all →
              </Link>
            </div>
            <div>
              {channel.topVideos.slice(0, 5).map((video) => (
                <TopPerformerRow key={video.youtubeId} slug={slug} video={video} />
              ))}
            </div>
          </AppPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <AppPanel className="flex flex-col gap-4 px-6 py-6">
            <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
              Topic Clusters
            </h2>
            <div className="grid gap-4">
              {channel.topicClusters.slice(0, 5).map((topic) => (
                <TopicClusterRow key={topic.topic} topic={topic} />
              ))}
            </div>
          </AppPanel>
          <AppPanel className="flex flex-col gap-4 px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                Top Hooks
              </h2>
              <Link
                href={`/app/channels/${slug}/hooks`}
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                View all →
              </Link>
            </div>
            <div className="grid gap-3">
              {channel.topHooks.slice(0, 3).map((hook) => (
                <HookRow key={`${hook.youtubeId}-${hook.startTime}`} hook={hook} />
              ))}
            </div>
          </AppPanel>
        </section>
      </div>
    </main>
  );
}
