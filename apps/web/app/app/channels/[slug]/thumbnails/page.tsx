"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import type { ChannelVideosResponse, VideoSummary } from "@ytscan/core";
import { AppPanel, ErrorState, TierBadge, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { useBackendQuery } from "@/lib/backend-client";
import {
  formatCompactNumber,
  formatDuration,
  formatUploadDate,
} from "@/lib/formatters";

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildPatternInsights(video: VideoSummary) {
  const analysis = video.thumbnailAnalysis;
  const insights: string[] = [];

  if (analysis?.visualHook) {
    insights.push(analysis.visualHook);
  }

  if (analysis?.whyItWorks) {
    insights.push(analysis.whyItWorks);
  }

  if (analysis?.textOverlayPresent) {
    insights.push(
      analysis.textOverlay
        ? `Visible text: “${analysis.textOverlay}” with ${analysis.textSize} treatment in the ${analysis.textPosition} region.`
        : `Text is present with ${analysis.textSize} treatment in the ${analysis.textPosition} region.`
    );
  }

  if (analysis?.hasFace) {
    insights.push(
      analysis.expression
        ? `${analysis.faceCount} face${analysis.faceCount === 1 ? "" : "s"} detected with a ${analysis.expression} expression.`
        : `${analysis.faceCount} face${analysis.faceCount === 1 ? "" : "s"} detected in the frame.`
    );
  }

  if (analysis?.compositionStyle && analysis.compositionStyle !== "other") {
    insights.push(`Composition style: ${titleCase(analysis.compositionStyle)}.`);
  }

  if (analysis?.dominantColors.length) {
    insights.push(`Dominant colors: ${analysis.dominantColors.map(titleCase).join(", ")}.`);
  }

  if (!insights.length) {
    insights.push(
      `${video.performanceTier === "viral" ? "High-performing" : "Steady"} thumbnail paired with a direct, concrete promise in the title.`
    );
    insights.push(
      `${formatCompactNumber(video.viewCount)} views suggests this framing is worth reusing for similar topics.`
    );
    insights.push(`Runtime of ${formatDuration(video.durationSec)} fits the channel's long-form editorial style.`);
  }

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

  if (videos.error) {
    return (
      <main className="app-page py-8">
        <ErrorState
          title="Thumbnail gallery unavailable"
          description="The app could not load thumbnail analysis for this channel. Retry to refresh the latest video and VLM data."
          action={<Button onClick={() => videos.refetch()}>Retry</Button>}
        />
      </main>
    );
  }

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
                  <div className="border-t border-separator pt-4">
                    <p className="mb-3 text-[15px] font-semibold text-foreground">Detected Elements</p>
                    {selectedVideo.thumbnailAnalysis ? (
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <p className="flex items-center justify-between gap-4">
                          <span>Primary subject</span>
                          <span className="font-medium text-foreground">
                            {selectedVideo.thumbnailAnalysis.primarySubject ?? "Unknown"}
                          </span>
                        </p>
                        <p className="flex items-center justify-between gap-4">
                          <span>Composition</span>
                          <span className="font-medium text-foreground">
                            {titleCase(selectedVideo.thumbnailAnalysis.compositionStyle)}
                          </span>
                        </p>
                        <p className="flex items-center justify-between gap-4">
                          <span>Clarity</span>
                          <span className="font-medium text-foreground">
                            {selectedVideo.thumbnailAnalysis.clarityScore
                              ? `${selectedVideo.thumbnailAnalysis.clarityScore}/10`
                              : "Not scored"}
                          </span>
                        </p>
                        <p className="text-[13px] leading-6">
                          Objects:{" "}
                          {selectedVideo.thumbnailAnalysis.objects.length
                            ? selectedVideo.thumbnailAnalysis.objects.map(titleCase).join(", ")
                            : "No strong objects detected."}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        This thumbnail has not been run through the VLM analysis pipeline yet.
                      </p>
                    )}
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
