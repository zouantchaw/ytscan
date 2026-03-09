"use client";

import Link from "next/link";
import { Check, CircleAlert, Clock3, LoaderCircle, Sparkles, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import type { ChannelDashboard, ScanJob } from "@ytscan/core";
import { AppPanel, ChannelAvatar, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";
import { formatRelativeDate } from "@/lib/formatters";

type ScanJobResponse = {
  job: ScanJob;
};

function getScanVisual(job: ScanJob) {
  if (job.status === "completed") {
    return {
      icon: Check,
      badge: "bg-success text-white",
      headline: "Scan Complete",
      description: "All available videos were ingested and the channel is ready to explore.",
    };
  }

  if (job.status === "failed") {
    return {
      icon: CircleAlert,
      badge: "bg-destructive/10 text-destructive",
      headline: "Scan Failed",
      description: job.message ?? "We hit an upstream blocker before the channel finished ingesting.",
    };
  }

  if (job.status === "canceled" || job.status === "cancelled") {
    return {
      icon: XCircle,
      badge: "bg-secondary text-muted-foreground",
      headline: "Scan Canceled",
      description: job.message ?? "This scan was canceled before it completed.",
    };
  }

  if (job.stage === "queued") {
    return {
      icon: Clock3,
      badge: "bg-secondary text-muted-foreground",
      headline: `Scanning ${job.requestedChannelSlug ?? "channel"}`,
      description: "Your scan is queued and will begin shortly.",
    };
  }

  if (job.stage === "vectorizing") {
    return {
      icon: Sparkles,
      badge: "bg-accent text-primary",
      headline: `Scanning ${job.requestedChannelSlug ?? "channel"}`,
      description: "Creating searchable transcript embeddings and ranking hooks.",
    };
  }

  if (job.stage === "processing") {
    return {
      icon: LoaderCircle,
      badge: "bg-accent text-primary",
      headline: `Scanning ${job.requestedChannelSlug ?? "channel"}`,
      description: "Cleaning transcripts, scoring videos, and extracting key signals.",
    };
  }

  return {
    icon: LoaderCircle,
    badge: "bg-accent text-primary",
    headline: `Scanning ${job.requestedChannelSlug ?? "channel"}`,
    description: "Downloading metadata, transcripts, and thumbnails for this channel.",
  };
}

function ScanPreviewCards({
  topVideos,
}: {
  topVideos: ChannelDashboard["topVideos"] | undefined;
}) {
  return (
    <section className="grid w-full max-w-[800px] gap-4">
      <p className="text-sm font-medium text-muted-foreground">Recently processed</p>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => {
          const video = topVideos?.[index];

          return (
            <AppPanel key={index} className="overflow-hidden">
              {video ? (
                <>
                  <VideoThumbnail
                    youtubeId={video.youtubeId}
                    title={video.title}
                    className="rounded-none border-0"
                  />
                  <div className="px-4 py-3">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{video.title}</p>
                  </div>
                </>
              ) : (
                <div className="aspect-[1.78/1] bg-secondary" />
              )}
            </AppPanel>
          );
        })}
      </div>
    </section>
  );
}

export default function ScanJobPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const jobResponse = useBackendQuery<ScanJobResponse>(`/scan/${encodeURIComponent(params.jobId)}`, {
    pollMs: 2500,
  });
  const job = jobResponse.data?.job;
  const channel = useBackendQuery<ChannelDashboard>(
    job?.requestedChannelSlug ? `/channels/${encodeURIComponent(job.requestedChannelSlug)}` : null,
    {
      enabled: Boolean(job?.requestedChannelSlug),
      pollMs: job?.status === "completed" ? null : 5000,
    }
  );

  const progressPercent = Math.max(0, Math.min(100, Math.round((job?.progress ?? 0) * 100)));
  const scanVisual = job ? getScanVisual(job) : null;
  const VisualIcon = scanVisual?.icon ?? LoaderCircle;
  const isTerminal = job?.status === "completed" || job?.status === "failed" || job?.status === "canceled" || job?.status === "cancelled";
  const activeChannelSlug = channel.data?.slug ?? job?.requestedChannelSlug ?? null;

  const scanSummary = useMemo(() => {
    if (!job) return null;

    if (job.status === "completed") {
      return [
        {
          label: "Videos",
          value: String(channel.data?.totalVideos ?? job.totalVideos ?? 0),
        },
        {
          label: "Transcripts",
          value: String(channel.data?.totalVideos ?? job.totalVideos ?? 0),
        },
        {
          label: "Thumbnails",
          value: String(channel.data?.totalVideos ?? job.totalVideos ?? 0),
        },
      ];
    }

    return [
      {
        label: "Stage",
        value: job.stage,
      },
      {
        label: "Status",
        value: job.status,
      },
      {
        label: "Updated",
        value: formatRelativeDate(job.updatedAt),
      },
    ];
  }, [channel.data, job]);

  async function retryScan() {
    if (!job) return;
    startTransition(async () => {
      try {
        const response = await fetchBackend<{ job: { jobId: string } }>("/scan", {
          method: "POST",
          body: JSON.stringify({ channelUrl: job.channelUrl }),
        });
        router.replace(`/app/scans/${response.job.jobId}`);
      } catch {
        // noop; the page already reflects terminal job state
      }
    });
  }

  if (!job) {
    return (
      <main className="app-page flex min-h-[calc(100vh-140px)] items-center justify-center pb-10 pt-4 lg:pt-0">
        <AppPanel className="h-[320px] w-full max-w-[640px]" />
      </main>
    );
  }

  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[13px] uppercase tracking-[0.08em] text-muted-foreground">
              Scan lifecycle
            </p>
            <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
              {scanVisual?.headline}
            </h1>
            <p className="max-w-[720px] text-[15px] leading-7 text-muted-foreground">
              {scanVisual?.description}
            </p>
          </div>
          {job.status === "completed" && activeChannelSlug ? (
            <Button asChild size="lg">
              <Link href={`/app/channels/${activeChannelSlug}`}>Open Dashboard</Link>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-8">
            <AppPanel className="flex min-h-[420px] flex-col items-center justify-center gap-6 px-8 py-10 text-center">
              <div className={`flex size-[72px] items-center justify-center rounded-full ${scanVisual?.badge}`}>
                {job.status === "completed" ? (
                  <VisualIcon className="size-8" />
                ) : (
                  <span className="text-[28px] font-semibold">{progressPercent}%</span>
                )}
              </div>

              {!isTerminal ? (
                <div className="grid w-full max-w-[560px] gap-3">
                  <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                    <span>
                      {job.processedVideos ?? 0} of {job.totalVideos ?? "?"} videos processed
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>Stage: {job.stage}</span>
                    <span>Status: {job.status}</span>
                    <span>{job.message ?? "Processing..."}</span>
                  </div>
                </div>
              ) : null}

              {job.status === "failed" || job.status === "canceled" || job.status === "cancelled" ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button onClick={retryScan} disabled={isPending}>
                    {isPending ? "Retrying..." : "Try Again"}
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/app/scans/new">Try Different URL</Link>
                  </Button>
                </div>
              ) : null}

              {job.status === "completed" && activeChannelSlug ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild>
                    <Link href={`/app/channels/${activeChannelSlug}`}>Go to Dashboard</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/app/scans/new">Scan Another Channel</Link>
                  </Button>
                </div>
              ) : null}
            </AppPanel>

            <ScanPreviewCards topVideos={channel.data?.topVideos} />
          </div>

          <div className="space-y-4">
            <AppPanel className="grid gap-3 px-5 py-5">
              <div className="flex items-center gap-3">
                <ChannelAvatar
                  channelName={channel.data?.channelName ?? job.requestedChannelSlug ?? "Channel"}
                  channelSlug={activeChannelSlug}
                />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold text-foreground">
                    {channel.data?.channelName ?? job.requestedChannelSlug ?? "Channel"}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">{job.channelUrl}</p>
                </div>
              </div>
              {scanSummary?.map((item) => (
                <p
                  key={item.label}
                  className="flex items-center justify-between gap-4 text-sm text-muted-foreground"
                >
                  <span>{item.label}</span>
                  <span className="font-medium capitalize text-foreground">{item.value}</span>
                </p>
              ))}
            </AppPanel>

            {!isTerminal ? (
              <AppPanel className="space-y-3 px-5 py-5">
                <p className="text-[14px] font-semibold text-foreground">What happens next</p>
                <p className="text-[14px] leading-6 text-muted-foreground">
                  The ingest worker will finish downloads, process transcripts, build vector
                  embeddings, and promote the channel into your workspace once complete.
                </p>
              </AppPanel>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
