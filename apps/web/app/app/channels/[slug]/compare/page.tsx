"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type {
  ChannelCompareResponse,
  ChannelDashboard,
  ChannelSummary,
} from "@ytscan/core";
import { AppPanel, ChannelAvatar, EmptyState } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { useBackendQuery } from "@/lib/backend-client";
import {
  formatCompactNumber,
  formatPercent,
  formatWeeklyRate,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

function winnerTone(active: boolean, side: "left" | "right") {
  if (!active) return "text-foreground";
  return side === "left" ? "text-success" : "text-primary";
}

function ComparisonStatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "left" | "right";
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center border-b border-separator py-4 text-[15px] last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", tone ? winnerTone(true, tone) : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

export default function ChannelComparePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const otherChannels = (channels.data?.items ?? []).filter((item) => item.slug !== slug);
  const rightSlug = searchParams.get("right") ?? otherChannels[0]?.slug ?? null;
  const comparison = useBackendQuery<ChannelCompareResponse>(
    rightSlug
      ? `/compare?left=${encodeURIComponent(slug)}&right=${encodeURIComponent(rightSlug)}`
      : null,
    { enabled: Boolean(rightSlug) }
  );
  const leftDashboard = useBackendQuery<ChannelDashboard>(
    `/channels/${encodeURIComponent(slug)}`
  );
  const rightDashboard = useBackendQuery<ChannelDashboard>(
    rightSlug ? `/channels/${encodeURIComponent(rightSlug)}` : null,
    { enabled: Boolean(rightSlug) }
  );
  const competitorIndex = otherChannels.findIndex((item) => item.slug === rightSlug);

  function handleCycleCompetitor() {
    if (otherChannels.length <= 1) return;
    const next = otherChannels[(competitorIndex + 1) % otherChannels.length];
    router.replace(`/app/channels/${slug}/compare?right=${encodeURIComponent(next.slug)}`);
  }

  if (!otherChannels.length) {
    return (
      <main className="app-page py-8">
        <EmptyState
          title="No competitor channels yet"
          description="Scan a second channel to unlock side-by-side comparison and gap analysis."
          actionLabel="+ Scan Channel"
          actionHref="/app/scans/new"
        />
      </main>
    );
  }

  if (!comparison.data || !leftDashboard.data || !rightDashboard.data) {
    return (
      <main className="app-page py-8">
        <div className="grid gap-6">
          <AppPanel className="h-[90px]" />
          <div className="grid gap-6 xl:grid-cols-[1fr_auto_1fr]">
            <AppPanel className="h-[322px]" />
            <div className="hidden w-12 xl:block" />
            <AppPanel className="h-[322px]" />
          </div>
        </div>
      </main>
    );
  }

  const left = leftDashboard.data;
  const right = rightDashboard.data;
  const leftViralPct =
    left.performanceBreakdown.find((item) => item.tier === "viral")?.percentage ?? 0;
  const rightViralPct =
    right.performanceBreakdown.find((item) => item.tier === "viral")?.percentage ?? 0;
  const leftTopTopic = left.topicClusters[0]?.topic ?? "—";
  const rightTopTopic = right.topicClusters[0]?.topic ?? "—";

  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <section className="flex items-center justify-between gap-4">
          <h1 className="font-display text-[48px] font-semibold tracking-[-0.05em] text-foreground">
            Competitor Analysis
          </h1>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href={`/app/channels/${slug}/compare/picker`}>Pick Channels</Link>
            </Button>
            <Button variant="outline" onClick={handleCycleCompetitor}>
              Rotate Competitor
            </Button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
          <AppPanel className="flex flex-col gap-5 px-6 py-6">
            <div className="flex items-center gap-4">
              <ChannelAvatar
                channelName={left.channelName}
                channelSlug={left.slug}
              />
              <div>
                <p className="font-display text-[18px] font-semibold tracking-[-0.03em] text-foreground">
                  {left.channelName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatCompactNumber(left.subscriberCount)} subs · {left.totalVideos} videos
                </p>
              </div>
            </div>
            <ComparisonStatRow
              label="Avg Views"
              value={formatCompactNumber(comparison.data.left.averageViews)}
              tone={
                comparison.data.left.averageViews >= comparison.data.right.averageViews
                  ? "left"
                  : undefined
              }
            />
            <ComparisonStatRow
              label="Engagement Rate"
              value={formatPercent(comparison.data.left.averageEngagementRate)}
              tone={
                comparison.data.left.averageEngagementRate >=
                comparison.data.right.averageEngagementRate
                  ? "left"
                  : undefined
              }
            />
            <ComparisonStatRow
              label="Upload Cadence"
              value={formatWeeklyRate(comparison.data.left.uploadCadencePerWeek)}
              tone={
                comparison.data.left.uploadCadencePerWeek >=
                comparison.data.right.uploadCadencePerWeek
                  ? "left"
                  : undefined
              }
            />
            <ComparisonStatRow
              label="Viral Rate"
              value={`${Math.round(leftViralPct * 100)}%`}
              tone={leftViralPct >= rightViralPct ? "left" : undefined}
            />
            <ComparisonStatRow
              label="Top Topic"
              value={leftTopTopic}
            />
          </AppPanel>

          <div className="hidden xl:flex xl:items-center xl:justify-center">
            <span className="text-[18px] font-semibold text-placeholder">VS</span>
          </div>

          <AppPanel className="flex flex-col gap-5 px-6 py-6">
            <div className="flex items-center gap-4">
              <ChannelAvatar
                channelName={right.channelName}
                channelSlug={right.slug}
              />
              <div>
                <p className="font-display text-[18px] font-semibold tracking-[-0.03em] text-foreground">
                  {right.channelName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatCompactNumber(right.subscriberCount)} subs · {right.totalVideos} videos
                </p>
              </div>
            </div>
            <ComparisonStatRow
              label="Avg Views"
              value={formatCompactNumber(comparison.data.right.averageViews)}
              tone={
                comparison.data.right.averageViews > comparison.data.left.averageViews
                  ? "right"
                  : undefined
              }
            />
            <ComparisonStatRow
              label="Engagement Rate"
              value={formatPercent(comparison.data.right.averageEngagementRate)}
              tone={
                comparison.data.right.averageEngagementRate >
                comparison.data.left.averageEngagementRate
                  ? "right"
                  : undefined
              }
            />
            <ComparisonStatRow
              label="Upload Cadence"
              value={formatWeeklyRate(comparison.data.right.uploadCadencePerWeek)}
              tone={
                comparison.data.right.uploadCadencePerWeek >
                comparison.data.left.uploadCadencePerWeek
                  ? "right"
                  : undefined
              }
            />
            <ComparisonStatRow
              label="Viral Rate"
              value={`${Math.round(rightViralPct * 100)}%`}
              tone={rightViralPct > leftViralPct ? "right" : undefined}
            />
            <ComparisonStatRow
              label="Top Topic"
              value={rightTopTopic}
            />
          </AppPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <AppPanel className="flex flex-col gap-4 px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                Content Gaps
              </h2>
              <p className="text-sm text-muted-foreground">
                Topics {right.channelName.split(" ")[0]} covers that {left.channelName.split(" ")[0]} doesn&apos;t
              </p>
            </div>
            <div className="grid gap-3">
              {comparison.data.topicGaps.slice(0, 3).map((gap) => (
                <div key={`${gap.topic}-${gap.sourceChannel}`} className="rounded-[8px] bg-background px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-medium text-foreground">{gap.topic}</p>
                      <p className="text-sm text-muted-foreground">
                        {gap.videoCount} videos · Avg {formatCompactNumber(gap.averageViews)} views
                      </p>
                    </div>
                    <span className="rounded-[8px] bg-accent px-3 py-1.5 text-sm font-medium text-primary">
                      {gap.opportunityScore >= 0.66
                        ? "High Opportunity"
                        : gap.opportunityScore >= 0.33
                          ? "Medium"
                          : "Emerging"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </AppPanel>

          <AppPanel className="flex flex-col gap-4 px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                Topic Overlap
              </h2>
              <p className="text-sm text-muted-foreground">Topics both channels cover</p>
            </div>
            <div className="grid gap-3">
              {comparison.data.topicOverlap.slice(0, 3).map((topic) => (
                <div key={topic.topic} className="rounded-[8px] bg-background px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-medium text-foreground">{topic.topic}</p>
                      <p className="text-sm text-muted-foreground">
                        {left.channelName.split(" ")[0]}: {formatCompactNumber(topic.leftAverageViews)} avg ·{" "}
                        {right.channelName.split(" ")[0]}: {formatCompactNumber(topic.rightAverageViews)} avg
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        topic.winnerSlug === slug
                          ? "text-success"
                          : topic.winnerSlug
                            ? "text-primary"
                            : "text-muted-foreground"
                      )}
                      >
                      {topic.winnerSlug === slug
                        ? `${left.channelName.split(" ")[0]} wins`
                        : topic.winnerSlug
                          ? `${right.channelName.split(" ")[0]} wins`
                          : "Even"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </AppPanel>
        </section>
      </div>
    </main>
  );
}
