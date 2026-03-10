"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Play } from "lucide-react";
import { useParams } from "next/navigation";
import type {
  ChannelDashboard,
  ChannelVideosResponse,
  HookLibraryResponse,
  SearchResponse,
  SearchResultItem,
  VideoSummary,
} from "@ytscan/core";
import { AppPanel, EmptyState, ErrorState, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { useBackendQuery } from "@/lib/backend-client";
import {
  formatCompactNumber,
  formatDuration,
  formatInteger,
  formatUploadDate,
} from "@/lib/formatters";

function buildTranscriptQuery(video: VideoSummary | null) {
  if (!video) return "";
  const keywords = video.title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((value) => value.length > 3)
    .slice(0, 6);
  return keywords.join(" ") || video.title;
}

function buildPerformanceScore(video: VideoSummary) {
  if (video.thumbnailAnalysis?.clarityScore) {
    return Math.min(99, 45 + video.thumbnailAnalysis.clarityScore * 5);
  }
  if (video.performanceTier === "viral") return 87;
  if (video.performanceTier === "strong") return 76;
  if (video.performanceTier === "average") return 61;
  return 42;
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildTopicTags(video: VideoSummary, dashboard: ChannelDashboard | null) {
  const titleWords = video.title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 3);
  const clusterMatches =
    dashboard?.topicClusters
      .filter((topic) =>
        titleWords.some((word) => topic.topic.toLowerCase().includes(word))
      )
      .slice(0, 3)
      .map((topic) => topic.topic) ?? [];

  return Array.from(new Set([...clusterMatches, ...titleWords])).slice(0, 5);
}

function buildTranscriptPassages(
  searchItems: SearchResultItem[],
  youtubeId: string
) {
  return searchItems.filter((item) => item.youtubeId === youtubeId).slice(0, 3);
}

export default function VideoDetailPage() {
  const params = useParams<{ slug: string; youtubeId: string }>();
  const slug = params.slug;
  const youtubeId = params.youtubeId;
  const dashboard = useBackendQuery<ChannelDashboard>(`/channels/${encodeURIComponent(slug)}`);
  const videos = useBackendQuery<ChannelVideosResponse>(
    `/channels/${encodeURIComponent(slug)}/videos?limit=250&sort=recent`
  );
  const hooks = useBackendQuery<HookLibraryResponse>(`/hooks/${encodeURIComponent(slug)}?sort=views`);
  const selectedVideo = useMemo(
    () => videos.data?.items.find((item) => item.youtubeId === youtubeId) ?? null,
    [videos.data?.items, youtubeId]
  );
  const transcriptQuery = useMemo(() => buildTranscriptQuery(selectedVideo), [selectedVideo]);
  const transcriptSearch = useBackendQuery<SearchResponse>(
    selectedVideo
      ? `/search?channel=${encodeURIComponent(slug)}&q=${encodeURIComponent(
          transcriptQuery
        )}&limit=18&mode=text`
      : null,
    { enabled: Boolean(selectedVideo) }
  );

  const matchingHooks =
    hooks.data?.items.filter((item) => item.youtubeId === youtubeId).slice(0, 3) ?? [];
  const transcriptPassages = buildTranscriptPassages(transcriptSearch.data?.items ?? [], youtubeId);
  const topicTags = selectedVideo ? buildTopicTags(selectedVideo, dashboard.data) : [];
  const score = selectedVideo ? buildPerformanceScore(selectedVideo) : 0;
  const thumbnailAnalysis = selectedVideo?.thumbnailAnalysis ?? null;

  if (videos.error || dashboard.error || hooks.error) {
    return (
      <main className="app-page py-9">
        <ErrorState
          title="Video detail unavailable"
          description="The app could not load this video detail view. Retry to refresh the channel, transcript, and thumbnail context."
          action={
            <Button
              onClick={() => {
                videos.refetch();
                dashboard.refetch();
                hooks.refetch();
                transcriptSearch.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      </main>
    );
  }

  if (!selectedVideo && !videos.isLoading) {
    return (
      <main className="app-page py-9">
        <EmptyState
          title="Video not found"
          description="We could not locate this video in the current channel dataset."
          actionLabel="Back to Dashboard"
          actionHref={`/app/channels/${slug}`}
        />
      </main>
    );
  }

  if (!selectedVideo) {
    return (
      <main className="app-page py-9">
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-6">
            <AppPanel className="h-[280px]" />
            <AppPanel className="h-[90px]" />
            <AppPanel className="h-[280px]" />
          </div>
          <div className="grid gap-5">
            <AppPanel className="h-[160px]" />
            <AppPanel className="h-[140px]" />
            <AppPanel className="h-[120px]" />
          </div>
        </div>
      </main>
    );
  }

  const viewRanking = [...(videos.data?.items ?? [])]
    .sort((left, right) => right.viewCount - left.viewCount)
    .findIndex((item) => item.youtubeId === youtubeId);
  const percentile = Math.max(
    1,
    Math.round(((viewRanking + 1) / Math.max(videos.data?.items.length ?? 1, 1)) * 100)
  );
  const primaryHook = matchingHooks[0];

  return (
    <main className="app-page py-9">
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-7">
          <section className="relative overflow-hidden rounded-[12px] bg-[#1A1A18]">
            <VideoThumbnail
              youtubeId={selectedVideo.youtubeId}
              title={selectedVideo.title}
              className="h-[280px] rounded-none border-0 object-cover opacity-70"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="flex size-16 items-center justify-center rounded-full bg-white/15 text-white">
                <Play className="size-7 fill-current" />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h1 className="font-display text-[34px] font-bold tracking-[-0.04em] text-foreground">
              {selectedVideo.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
              <span>Published {formatUploadDate(selectedVideo.uploadDate)}</span>
              <span>{formatDuration(selectedVideo.durationSec)} duration</span>
              <a
                href={selectedVideo.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:text-primary/80"
              >
                Watch on YouTube
              </a>
            </div>
          </section>

          <section className="flex flex-wrap gap-5">
            <MetricStat label="Views" value={formatCompactNumber(selectedVideo.viewCount)} />
            <MetricStat label="Likes" value={formatCompactNumber(selectedVideo.likeCount)} />
            <MetricStat label="Comments" value={formatInteger(selectedVideo.commentCount)} />
            <MetricStat
              label="Performance"
              value={`Top ${percentile}%`}
              tone="primary"
            />
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.03em] text-foreground">
              Transcript
            </h2>
            <AppPanel className="grid gap-4 px-5 py-5">
              {transcriptPassages.length ? (
                transcriptPassages.map((item) => (
                  <div key={item.vectorId} className="flex gap-3">
                    <span className="w-10 shrink-0 text-[12px] font-medium text-primary">
                      {item.timestampLabel}
                    </span>
                    <p className="text-[14px] leading-7 text-foreground">{item.snippet}</p>
                  </div>
                ))
              ) : primaryHook ? (
                <div className="flex gap-3">
                  <span className="w-10 shrink-0 text-[12px] font-medium text-primary">
                    {primaryHook.timestampLabel}
                  </span>
                  <p className="text-[14px] leading-7 text-foreground">{primaryHook.text}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Transcript passages will appear here once a tighter search match is found.
                </p>
              )}
            </AppPanel>
          </section>
        </div>

        <aside className="grid gap-6">
          <AppPanel className="grid gap-3 px-5 py-5">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">
              Thumbnail Analysis
            </h2>
            <div className="flex items-center gap-2">
              <span className="rounded-[4px] bg-success px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-white">
                {selectedVideo.performanceTier === "viral" ? "A Tier" : "Tracked"}
              </span>
              <span className="text-[13px] text-muted-foreground">Score: {score}/100</span>
            </div>
            {thumbnailAnalysis ? (
              <div className="grid gap-2 text-[13px] leading-6 text-muted-foreground">
                <p>{thumbnailAnalysis.whyItWorks ?? "Structured thumbnail analysis available."}</p>
                {thumbnailAnalysis.visualHook ? <p>{thumbnailAnalysis.visualHook}</p> : null}
                <p>
                  {thumbnailAnalysis.textOverlayPresent
                    ? `Text is present in the ${thumbnailAnalysis.textPosition} region with ${thumbnailAnalysis.textSize} emphasis.`
                    : "No meaningful text overlay detected in the thumbnail."}
                </p>
                <p>
                  {thumbnailAnalysis.hasFace
                    ? `${thumbnailAnalysis.faceCount} face${thumbnailAnalysis.faceCount === 1 ? "" : "s"} detected${thumbnailAnalysis.expression ? ` with a ${thumbnailAnalysis.expression} expression` : ""}.`
                    : "No face detected. The image relies on objects, layout, or text instead."}
                </p>
              </div>
            ) : (
              <div className="grid gap-1 text-[13px] leading-6 text-muted-foreground">
                <p>Clear value proposition paired with a concrete title.</p>
                <p>{selectedVideo.performanceTier === "viral" ? "Strong contrast and emotion" : "Solid editorial framing"}.</p>
                <p>Thumbnail and title create a clear curiosity gap for this topic.</p>
              </div>
            )}
          </AppPanel>

          <AppPanel className="grid gap-3 px-5 py-5">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">
              Hook Pattern
            </h2>
            {primaryHook ? (
              <>
                <span className="w-fit rounded-[4px] bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-primary">
                  {primaryHook.hookType.replace(/_/g, " ")}
                </span>
                <p className="text-[13px] leading-6 text-muted-foreground">
                  Opens with {primaryHook.hookType.replace(/_/g, " ")} framing and uses a concrete promise in the
                  first minute.
                </p>
              </>
            ) : (
              <p className="text-[13px] leading-6 text-muted-foreground">
                Hook analysis will appear here once the library finds a first-minute segment for this video.
              </p>
            )}
          </AppPanel>

          <AppPanel className="grid gap-3 px-5 py-5">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">
              Topics
            </h2>
            <div className="flex flex-wrap gap-2">
              {topicTags.map((topic) => (
                <span
                  key={topic}
                  className="rounded-[4px] bg-secondary px-2.5 py-1 text-[12px] font-medium text-muted-foreground"
                >
                  {topic}
                </span>
              ))}
            </div>
          </AppPanel>

          {thumbnailAnalysis ? (
            <AppPanel className="grid gap-3 px-5 py-5">
              <h2 className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">
                VLM Fields
              </h2>
              <div className="grid gap-2 text-[13px] leading-6 text-muted-foreground">
                <p>
                  Primary subject:{" "}
                  <span className="font-medium text-foreground">
                    {thumbnailAnalysis.primarySubject ?? "Unknown"}
                  </span>
                </p>
                <p>
                  Composition:{" "}
                  <span className="font-medium text-foreground">
                    {titleCase(thumbnailAnalysis.compositionStyle)}
                  </span>
                </p>
                <p>
                  Colors:{" "}
                  <span className="font-medium text-foreground">
                    {thumbnailAnalysis.dominantColors.length
                      ? thumbnailAnalysis.dominantColors.map(titleCase).join(", ")
                      : "Not detected"}
                  </span>
                </p>
                <p>
                  Objects:{" "}
                  <span className="font-medium text-foreground">
                    {thumbnailAnalysis.objects.length
                      ? thumbnailAnalysis.objects.map(titleCase).join(", ")
                      : "Not detected"}
                  </span>
                </p>
              </div>
            </AppPanel>
          ) : null}

          <Button asChild variant="dark">
            <Link href={`/app/channels/${slug}/script-lab?topic=${encodeURIComponent(selectedVideo.title)}`}>
              Use in Script Lab
            </Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}

function MetricStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary";
}) {
  return (
    <AppPanel className={tone === "primary" ? "bg-accent px-5 py-4" : "px-5 py-4"}>
      <div className={tone === "primary" ? "text-primary" : "text-foreground"}>
        <p className="font-display text-[22px] font-bold tracking-[-0.03em]">{value}</p>
        <p className="text-[12px] text-muted-foreground">{label}</p>
      </div>
    </AppPanel>
  );
}
