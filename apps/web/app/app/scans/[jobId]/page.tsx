"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ChannelDashboard, ScanJob } from "@ytscan/core";
import { AppLogo } from "@/components/brand/app-logo";
import { AppPanel, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";

function ScanHeader() {
  return (
    <header className="border-b border-separator bg-background">
      <div className="app-page flex h-[69px] items-center justify-between">
        <AppLogo size="sm" />
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/app/channels">Cancel Scan</Link>
          </Button>
          <div className="size-9 rounded-full bg-secondary" />
        </div>
      </div>
    </header>
  );
}

type ScanJobResponse = {
  job: ScanJob;
};

export default function ScanJobPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const jobResponse = useBackendQuery<ScanJobResponse>(
    `/scan/${encodeURIComponent(params.jobId)}`,
    { pollMs: 2500 }
  );
  const job = jobResponse.data?.job;
  const channel = useBackendQuery<ChannelDashboard>(
    job?.requestedChannelSlug && job.status === "completed"
      ? `/channels/${encodeURIComponent(job.requestedChannelSlug)}`
      : null,
    {
      enabled: Boolean(job?.requestedChannelSlug && job?.status === "completed"),
    }
  );

  async function retryScan() {
    if (!job) return;
    startTransition(async () => {
      const response = await fetchBackend<{ job: { jobId: string } }>("/scan", {
        method: "POST",
        body: JSON.stringify({ channelUrl: job.channelUrl }),
      });
      router.replace(`/app/scans/${response.job.jobId}`);
    });
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <ScanHeader />
        <main className="app-page flex min-h-[calc(100vh-69px)] items-center justify-center py-12">
          <AppPanel className="h-[220px] w-full max-w-[560px]" />
        </main>
      </div>
    );
  }

  const progressPercent = Math.max(0, Math.min(100, Math.round(job.progress * 100)));

  if (job.status === "failed") {
    return (
      <div className="min-h-screen bg-background">
        <ScanHeader />
        <main className="app-page flex min-h-[calc(100vh-69px)] flex-col items-center justify-center gap-6 py-12 text-center">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-accent text-[32px] font-semibold text-primary">
            !
          </div>
          <div className="max-w-[480px] space-y-2">
            <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
              Scan Failed
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              We couldn&apos;t complete the scan for this channel. This usually means the URL was invalid or the ingest worker hit an upstream blocker.
            </p>
          </div>
          <AppPanel className="grid w-full max-w-[400px] gap-3 px-5 py-5 text-left">
            <p className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span>Channel</span>
              <span className="font-medium text-foreground">{job.requestedChannelSlug ?? job.channelUrl}</span>
            </p>
            <p className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span>Error code</span>
              <span className="font-medium text-foreground">{job.stage.toUpperCase()}</span>
            </p>
            <p className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span>Attempted</span>
              <span className="font-medium text-foreground">{job.updatedAt}</span>
            </p>
          </AppPanel>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={retryScan} disabled={isPending}>
              {isPending ? "Retrying..." : "Try Again"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/scans/new">Try Different URL</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (job.status === "completed") {
    return (
      <div className="min-h-screen bg-background">
        <ScanHeader />
        <main className="app-page flex min-h-[calc(100vh-69px)] flex-col items-center justify-center gap-8 py-12 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-success text-[34px] font-semibold text-white">
            ✓
          </div>
          <div className="max-w-[540px] space-y-2">
            <h1 className="font-display text-[42px] font-semibold tracking-[-0.05em] text-foreground">
              Scan Complete!
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              We&apos;ve finished analyzing {channel.data?.channelName ?? job.requestedChannelSlug ?? "this channel"}. Here&apos;s a snapshot of what&apos;s now ready in the workspace.
            </p>
          </div>
          <div className="grid w-full max-w-[720px] gap-5 md:grid-cols-4">
            <div className="space-y-2">
              <p className="font-display text-[38px] font-semibold tracking-[-0.04em] text-foreground">
                {channel.data?.totalVideos ?? job.totalVideos ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Videos scanned</p>
            </div>
            <div className="space-y-2">
              <p className="font-display text-[38px] font-semibold tracking-[-0.04em] text-foreground">
                {channel.data?.totalVideos ?? job.totalVideos ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Transcripts</p>
            </div>
            <div className="space-y-2">
              <p className="font-display text-[38px] font-semibold tracking-[-0.04em] text-foreground">
                {channel.data?.totalVideos ?? job.totalVideos ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Thumbnails</p>
            </div>
            <div className="space-y-2">
              <p className="font-display text-[38px] font-semibold tracking-[-0.04em] text-foreground">
                {channel.data?.topicClusters.length ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Topic clusters</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href={channel.data ? `/app/channels/${channel.data.slug}` : "/app/channels"}>
                Go to Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/scans/new">Scan Another Channel</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ScanHeader />
      <main className="app-page flex min-h-[calc(100vh-69px)] flex-col items-center gap-10 py-12">
        <section className="flex max-w-[560px] flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-[16px] bg-accent text-primary">
            <span className="text-[22px] font-semibold">{progressPercent}%</span>
          </div>
          <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
            Scanning {job.requestedChannelSlug ?? "channel"}
          </h1>
          <p className="text-[15px] leading-7 text-muted-foreground">
            Ingesting metadata, transcripts, and thumbnails for this channel.
          </p>
        </section>

        <section className="grid w-full max-w-[560px] gap-3">
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>
              {job.processedVideos ?? 0} of {job.totalVideos ?? "?"} videos processed
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Stage: {job.stage}</span>
            <span>Status: {job.status}</span>
            <span>{job.message ?? "Processing..."}</span>
          </div>
        </section>

        <section className="grid w-full max-w-[800px] gap-4">
          <p className="text-sm font-medium text-muted-foreground">Recently processed</p>
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <AppPanel key={index} className="overflow-hidden">
                {channel.data?.topVideos[index] ? (
                  <>
                    <VideoThumbnail
                      youtubeId={channel.data.topVideos[index].youtubeId}
                      title={channel.data.topVideos[index].title}
                      className="rounded-none border-0"
                    />
                    <div className="px-4 py-3">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">
                        {channel.data.topVideos[index].title}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="h-[178px] bg-secondary" />
                )}
              </AppPanel>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
