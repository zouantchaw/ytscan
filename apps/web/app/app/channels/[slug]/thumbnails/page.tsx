"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import type { ChannelVideosResponse, VideoSummary } from "@ytscan/core";
import { AppPanel, TierBadge, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { useBackendQuery } from "@/lib/backend-client";
import {
  formatCompactNumber,
  formatDuration,
  formatUploadDate,
} from "@/lib/formatters";

function buildPatternInsights(video: VideoSummary) {
  const insights = [
    `${video.performanceTier === "viral" ? "High-performing" : "Steady"} thumbnail paired with a direct, concrete promise in the title.`,
    `${formatCompactNumber(video.viewCount)} views suggests this framing is worth reusing for similar topics.`,
    `Runtime of ${formatDuration(video.durationSec)} fits the channel's long-form editorial style.`,
  ];

  return insights;
}

export default function ThumbnailGalleryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [sortMode, setSortMode] = useState<"views" | "recent">("views");
  const [filterMode, setFilterMode] = useState<"all" | "viral">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const videos = useBackendQuery<ChannelVideosResponse>(
    `/channels/${encodeURIComponent(slug)}/videos?limit=150&sort=${sortMode}`
  );

  const visibleVideos =
    filterMode === "viral"
      ? (videos.data?.items ?? []).filter((video) => video.performanceTier === "viral")
      : videos.data?.items ?? [];
  const selectedVideo =
    visibleVideos.find((video) => video.youtubeId === selectedId) ?? visibleVideos[0] ?? null;

  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-[48px] font-semibold tracking-[-0.05em] text-foreground">
              Thumbnail Gallery
            </h1>
            <p className="text-sm text-muted-foreground">
              {visibleVideos.length} thumbnails analyzed · pattern insights extracted
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortMode((current) => (current === "views" ? "recent" : "views"))}
            >
              Sort: {sortMode === "views" ? "Highest performers" : "Most recent"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterMode((current) => (current === "all" ? "viral" : "all"))}
            >
              Filter: {filterMode === "all" ? "All tiers" : "Viral only"}
            </Button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_374px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleVideos.slice(0, 9).map((video) => (
              <button
                key={video.youtubeId}
                type="button"
                onClick={() => setSelectedId(video.youtubeId)}
                className="text-left"
              >
                <AppPanel className="overflow-hidden">
                  <VideoThumbnail
                    youtubeId={video.youtubeId}
                    title={video.title}
                    className="rounded-none border-0"
                  />
                  <div className="grid gap-2 px-4 py-4">
                    <p className="line-clamp-2 text-[15px] font-medium text-foreground">
                      {video.title}
                    </p>
                    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                      <span>{formatCompactNumber(video.viewCount)} views</span>
                      <TierBadge tier={video.performanceTier} />
                    </div>
                  </div>
                </AppPanel>
              </button>
            ))}
          </div>

          <aside>
            <AppPanel className="sticky top-24 grid gap-4 px-6 py-6">
              <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                VLM Analysis
              </h2>

              {selectedVideo ? (
                <>
                  <VideoThumbnail youtubeId={selectedVideo.youtubeId} title={selectedVideo.title} />
                  <div className="space-y-3">
                    <p className="text-[16px] font-semibold text-foreground">{selectedVideo.title}</p>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <p className="flex items-center justify-between gap-4">
                        <span>Views</span>
                        <span className="font-medium text-foreground">
                          {formatCompactNumber(selectedVideo.viewCount)}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-4">
                        <span>Duration</span>
                        <span className="font-medium text-foreground">
                          {formatDuration(selectedVideo.durationSec)}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-4">
                        <span>Uploaded</span>
                        <span className="font-medium text-foreground">
                          {formatUploadDate(selectedVideo.uploadDate)}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-4">
                        <span>Tier</span>
                        <TierBadge tier={selectedVideo.performanceTier} />
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-separator pt-4">
                    <p className="mb-3 text-[15px] font-semibold text-foreground">Pattern Insights</p>
                    <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
                      {buildPatternInsights(selectedVideo).map((insight) => (
                        <p key={insight}>{insight}</p>
                      ))}
                    </div>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/app/channels/${slug}/videos/${selectedVideo.youtubeId}`}>
                      Open Video Detail
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a thumbnail to inspect its current performance pattern.
                </p>
              )}
            </AppPanel>
          </aside>
        </section>
      </div>
    </main>
  );
}
