"use client";

import { useEffect, useState, useTransition } from "react";
import { Search as SearchIcon } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type {
  ChannelDashboard,
  ChannelVideosResponse,
  SearchResponse,
} from "@ytscan/core";
import { AppPanel, EmptyState, TierBadge, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackendQuery } from "@/lib/backend-client";
import { getDefaultSearchPrompt } from "@/lib/channel-ui";
import {
  formatCompactNumber,
  formatDuration,
} from "@/lib/formatters";

function buildDateFrom() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[8px] border border-border px-4 py-1.5 text-[13px] text-muted-foreground">
      {children}
    </span>
  );
}

export default function ChannelSearchPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const channel = useBackendQuery<ChannelDashboard>(
    `/channels/${encodeURIComponent(slug)}`
  );
  const videos = useBackendQuery<ChannelVideosResponse>(
    `/channels/${encodeURIComponent(slug)}/videos?limit=250&sort=recent`
  );
  const defaultQuery = getDefaultSearchPrompt(slug, channel.data?.channelName ?? "this creator");
  const submittedQuery = searchParams.get("q")?.trim() || defaultQuery;
  const [inputValue, setInputValue] = useState(submittedQuery);
  const [isPending, startTransition] = useTransition();
  const dateFrom = searchParams.get("date_from") ?? buildDateFrom();
  const minViews = Number(searchParams.get("min_views") ?? "100000");
  const results = useBackendQuery<SearchResponse>(
    `/search?channel=${encodeURIComponent(slug)}&q=${encodeURIComponent(
      submittedQuery
    )}&limit=12&mode=semantic&min_views=${minViews}&date_from=${dateFrom}`
  );

  useEffect(() => {
    setInputValue(submittedQuery);
  }, [submittedQuery]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = inputValue.trim() || defaultQuery;

    startTransition(() => {
      router.replace(
        `/app/channels/${slug}/search?q=${encodeURIComponent(
          nextQuery
        )}&min_views=${minViews}&date_from=${dateFrom}`
      );
    });
  }

  const videoMap = new Map(
    (videos.data?.items ?? []).map((video) => [video.youtubeId, video])
  );

  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <section className="grid gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 xl:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-[12px] border border-border bg-card px-4">
              <SearchIcon className="size-5 text-muted-foreground" />
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={defaultQuery}
                className="h-[44px] border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit" variant="dark" size="lg" disabled={isPending}>
              {isPending ? "Searching..." : "Search"}
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Filters:</span>
            <FilterChip>Min views: {formatCompactNumber(minViews)}</FilterChip>
            <FilterChip>All tiers</FilterChip>
            <FilterChip>Last 12 months</FilterChip>
            {channel.data ? <FilterChip>{channel.data.channelName}</FilterChip> : null}
          </div>

          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>
              {results.data?.count ?? 0} results across {results.data?.videoCount ?? 0} videos
            </span>
            <span>
              Sort by:{" "}
              <span className="font-medium text-foreground">
                {results.data?.mode === "semantic" ? "Relevance" : "Views"}
              </span>
            </span>
          </div>
        </section>

        <section className="grid gap-3">
          {(results.data?.items ?? []).length ? (
            (results.data?.items ?? []).map((item) => {
              const video = videoMap.get(item.youtubeId);
              return (
                <AppPanel
                  key={item.vectorId}
                  className="grid gap-4 px-5 py-5 md:grid-cols-[100px_1fr]"
                >
                  <VideoThumbnail
                    youtubeId={item.youtubeId}
                    title={item.title}
                    className="h-[60px] rounded-[10px] object-cover"
                    aspect="card"
                  />
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold text-foreground">{item.title}</h2>
                      <TierBadge tier={item.performanceTier} />
                      <span className="text-sm text-muted-foreground">
                        {formatCompactNumber(item.viewCount)} views
                        {video ? ` · ${formatDuration(video.durationSec)}` : ""}
                      </span>
                    </div>
                    <div className="rounded-[8px] bg-background px-4 py-4">
                      <p className="border-l-[3px] border-primary pl-4 text-[15px] leading-7 text-foreground">
                        &ldquo;{item.snippet}&rdquo;
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="font-medium text-primary">{item.timestampLabel}</span>
                      {item.score ? (
                        <span>Relevance: {item.score.toFixed(2)}</span>
                      ) : null}
                    </div>
                  </div>
                </AppPanel>
              );
            })
          ) : (
            <EmptyState
              title="No matches yet"
              description="Try broadening the topic, lowering the minimum views filter, or searching for a different phrase."
            />
          )}
        </section>
      </div>
    </main>
  );
}
