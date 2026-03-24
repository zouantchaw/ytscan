"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { ChannelDashboard, ChannelVideosResponse, VideoSummary } from "@ytscan/core";
import {
  AppPanel,
  EmptyState,
  ErrorState,
  MetricCard,
  TierBadge,
  VideoThumbnail,
} from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackendQuery } from "@/lib/backend-client";
import {
  formatCompactNumber,
  formatDuration,
  formatPercent,
  formatUploadDate,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

const TIER_FILTERS = [
  { label: "All tiers", value: "" },
  { label: "Viral", value: "viral" },
  { label: "Strong", value: "strong" },
  { label: "Average", value: "average" },
  { label: "Underperform", value: "underperform" },
];

const DURATION_FILTERS = [
  { label: "All lengths", value: "" },
  { label: "0-8 min", value: "0-8" },
  { label: "8-18 min", value: "8-18" },
  { label: "18-30 min", value: "18-30" },
  { label: "30+ min", value: "30+" },
];

const SORT_OPTIONS = [
  { label: "Recent", value: "recent" },
  { label: "Views", value: "views" },
  { label: "Engagement", value: "engagement" },
];

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[8px] px-4 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-foreground text-white"
          : "bg-secondary text-muted-foreground hover:bg-border hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function VideoArchiveRow({ slug, video }: { slug: string; video: VideoSummary }) {
  return (
    <tr className="border-b border-separator last:border-b-0">
      <td className="py-4 pr-4">
        <Link
          href={`/app/channels/${slug}/videos/${video.youtubeId}`}
          className="grid min-w-0 grid-cols-[96px_1fr] items-start gap-4"
        >
          <VideoThumbnail
            youtubeId={video.youtubeId}
            title={video.title}
            className="h-[54px] rounded-[8px] object-cover"
            aspect="card"
          />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-[15px] font-medium text-foreground">{video.title}</p>
            <p className="line-clamp-2 text-[13px] leading-6 text-muted-foreground">
              {video.description || "No description captured for this video."}
            </p>
          </div>
        </Link>
      </td>
      <td className="whitespace-nowrap py-4 pr-4 text-[13px] text-muted-foreground">
        {formatUploadDate(video.uploadDate)}
      </td>
      <td className="whitespace-nowrap py-4 pr-4 text-[13px] text-muted-foreground">
        {formatDuration(video.durationSec)}
      </td>
      <td className="whitespace-nowrap py-4 pr-4 text-[13px] font-medium text-foreground">
        {formatCompactNumber(video.viewCount)}
      </td>
      <td className="whitespace-nowrap py-4 pr-4 text-[13px] text-muted-foreground">
        {formatPercent(video.engagementRate)}
      </td>
      <td className="whitespace-nowrap py-4 text-right">
        <TierBadge tier={video.performanceTier} />
      </td>
    </tr>
  );
}

export default function ChannelVideosPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const [isPending, startTransition] = useTransition();
  const submittedQuery = searchParams.get("q")?.trim() ?? "";
  const performanceTier = searchParams.get("performanceTier")?.trim() ?? "";
  const durationBucket = searchParams.get("durationBucket")?.trim() ?? "";
  const sort = searchParams.get("sort")?.trim() || "recent";
  const [inputValue, setInputValue] = useState(submittedQuery);

  useEffect(() => {
    setInputValue(submittedQuery);
  }, [submittedQuery]);

  const queryString = useMemo(() => {
    const next = new URLSearchParams();
    next.set("limit", "250");
    next.set("sort", sort === "views" || sort === "engagement" ? sort : "recent");
    if (submittedQuery) next.set("q", submittedQuery);
    if (performanceTier) next.set("performanceTier", performanceTier);
    if (durationBucket) next.set("durationBucket", durationBucket);
    return next.toString();
  }, [durationBucket, performanceTier, sort, submittedQuery]);

  const channel = useBackendQuery<ChannelDashboard>(`/channels/${encodeURIComponent(slug)}`);
  const videos = useBackendQuery<ChannelVideosResponse>(
    `/channels/${encodeURIComponent(slug)}/videos?${queryString}`
  );

  const hasActiveFilters = Boolean(submittedQuery || performanceTier || durationBucket || sort !== "recent");

  function replaceSearch(nextParams: URLSearchParams) {
    const nextQuery = nextParams.toString();
    startTransition(() => {
      router.replace(
        nextQuery
          ? `/app/channels/${slug}/videos?${nextQuery}`
          : `/app/channels/${slug}/videos`
      );
    });
  }

  function updateFilters(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    replaceSearch(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({ q: inputValue.trim() || null });
  }

  if (channel.error || videos.error) {
    return (
      <main className="app-page py-8">
        <ErrorState
          title="Video archive unavailable"
          description="The channel archive could not be loaded. Retry to refresh the latest metadata and filters."
          action={
            <Button
              onClick={() => {
                channel.refetch();
                videos.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      </main>
    );
  }

  if (channel.isLoading || videos.isLoading || !channel.data || !videos.data) {
    return (
      <main className="app-page py-8">
        <div className="grid gap-6">
          <AppPanel className="h-[144px]" />
          <div className="grid gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <AppPanel key={index} className="h-[120px]" />
            ))}
          </div>
          <AppPanel className="h-[640px]" />
        </div>
      </main>
    );
  }

  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <section className="space-y-2">
          <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
            Video Archive
          </h1>
          <p className="max-w-[760px] text-[15px] leading-7 text-muted-foreground">
            Browse every scanned upload, filter by performance, and inspect the full historical
            record without digging through YouTube&apos;s UI.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Videos in View"
            value={formatCompactNumber(videos.data.stats.totalVideos)}
            detail={`${formatCompactNumber(videos.data.totalCount)} in full archive`}
          />
          <MetricCard
            label="Views in View"
            value={formatCompactNumber(videos.data.stats.totalViews)}
            detail={`${formatCompactNumber(videos.data.stats.averageViews)} avg views`}
          />
          <MetricCard
            label="Average Duration"
            value={formatDuration(videos.data.stats.averageDurationSec)}
            detail="Across the current filtered set"
          />
          <MetricCard
            label="Avg Engagement"
            value={formatPercent(videos.data.stats.averageEngagementRate)}
            detail={`${formatCompactNumber(videos.data.count)} rows returned`}
          />
        </section>

        <AppPanel className="grid gap-5 px-6 py-6">
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 lg:flex-row">
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Search titles, descriptions, and tags"
                className="h-12 lg:max-w-[420px]"
              />
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((option) => (
                  <FilterButton
                    key={option.value}
                    active={sort === option.value}
                    onClick={() => updateFilters({ sort: option.value })}
                  >
                    {option.label}
                  </FilterButton>
                ))}
              </div>
              <Button type="submit" disabled={isPending} className="lg:ml-auto">
                {isPending ? "Updating..." : "Apply filters"}
              </Button>
            </form>

            <div className="grid gap-3 xl:grid-cols-2">
              <div className="flex flex-wrap gap-2">
                {TIER_FILTERS.map((option) => (
                  <FilterButton
                    key={option.value || "all"}
                    active={performanceTier === option.value}
                    onClick={() => updateFilters({ performanceTier: option.value || null })}
                  >
                    {option.label}
                  </FilterButton>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {DURATION_FILTERS.map((option) => (
                  <FilterButton
                    key={option.value || "all"}
                    active={durationBucket === option.value}
                    onClick={() => updateFilters({ durationBucket: option.value || null })}
                  >
                    {option.label}
                  </FilterButton>
                ))}
                {hasActiveFilters ? (
                  <Button
                    variant="ghost"
                    className="text-[13px] font-medium"
                    onClick={() => {
                      setInputValue("");
                      router.replace(`/app/channels/${slug}/videos`);
                    }}
                  >
                    Reset filters
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {videos.data.items.length ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
                <span>
                  Showing {formatCompactNumber(videos.data.count)} videos from a{" "}
                  {formatCompactNumber(videos.data.totalCount)}-video archive
                </span>
                {submittedQuery ? <span>Query: &ldquo;{submittedQuery}&rdquo;</span> : null}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-separator text-left text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Video</th>
                      <th className="py-3 pr-4 font-medium">Published</th>
                      <th className="py-3 pr-4 font-medium">Length</th>
                      <th className="py-3 pr-4 font-medium">Views</th>
                      <th className="py-3 pr-4 font-medium">Engagement</th>
                      <th className="py-3 text-right font-medium">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.data.items.map((video) => (
                      <VideoArchiveRow key={video.youtubeId} slug={slug} video={video} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No videos match these filters"
              description="Try widening the query, removing a tier filter, or resetting the duration range to bring more of the archive back into view."
              actionLabel="Reset archive filters"
              actionHref={`/app/channels/${slug}/videos`}
            />
          )}
        </AppPanel>
      </div>
    </main>
  );
}
