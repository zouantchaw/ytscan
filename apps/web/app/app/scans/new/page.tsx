"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChannelSummary } from "@ytscan/core";
import { AppPanel, ChannelAvatar } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.hostname}${path}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

function extractChannelIdentifier(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const segments = url.pathname.split("/").filter(Boolean);
    const handle = segments.find((segment) => segment.startsWith("@"));
    if (handle) return handle.slice(1).toLowerCase();
    const channelIdIndex = segments.findIndex((segment) => segment === "channel");
    if (channelIdIndex >= 0 && segments[channelIdIndex + 1]) {
      return segments[channelIdIndex + 1].toLowerCase();
    }
    return segments.at(-1)?.toLowerCase() ?? "";
  } catch {
    return trimmed.toLowerCase();
  }
}

function findDuplicateChannel(channels: ChannelSummary[], channelUrl: string) {
  const normalizedInputUrl = normalizeUrl(channelUrl);
  const normalizedInputIdentifier = extractChannelIdentifier(channelUrl);

  return (
    channels.find((channel) => {
      const normalizedChannelUrl = normalizeUrl(channel.channelUrl);
      const normalizedChannelIdentifier = extractChannelIdentifier(channel.channelUrl);
      const normalizedSlug = channel.slug.toLowerCase().replace(/-/g, "");
      const normalizedInputSlug = normalizedInputIdentifier.replace(/-/g, "").replace(/_/g, "");

      return (
        Boolean(normalizedInputUrl && normalizedInputUrl === normalizedChannelUrl) ||
        Boolean(
          normalizedInputIdentifier &&
            (normalizedInputIdentifier === normalizedChannelIdentifier ||
              normalizedInputIdentifier === channel.channelYoutubeId?.toLowerCase() ||
              normalizedInputSlug === normalizedSlug)
        )
      );
    }) ?? null
  );
}

export default function NewScanPage() {
  const router = useRouter();
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const [channelUrl, setChannelUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("ytscan:first-channel-url") ?? "";
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const duplicateChannel = useMemo(
    () => findDuplicateChannel(channels.data?.items ?? [], channelUrl),
    [channelUrl, channels.data?.items]
  );

  function queueScan(nextChannelUrl: string) {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetchBackend<{ job: { jobId: string } }>("/scan", {
          method: "POST",
          body: JSON.stringify({ channelUrl: nextChannelUrl.trim() }),
        });
        router.push(`/app/scans/${response.job.jobId}`);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to start scan.");
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!channelUrl.trim()) {
      setError("Paste a YouTube channel URL to start a scan.");
      return;
    }

    if (duplicateChannel) {
      setError(null);
      return;
    }

    queueScan(channelUrl);
  }

  if (duplicateChannel) {
    return (
      <main className="app-page flex min-h-[calc(100vh-140px)] items-center justify-center pb-10 pt-4 lg:pt-0">
        <div className="flex w-full max-w-[540px] flex-col items-center gap-8 text-center">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <AlertCircle className="size-8" />
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
              Channel Already Exists
            </h1>
            <p className="text-[16px] leading-8 text-muted-foreground">
              {duplicateChannel.channelName} was scanned and is already available in your workspace.
              You can open the existing channel or rescan to refresh the data.
            </p>
          </div>

          <AppPanel className="flex w-full items-center gap-4 px-6 py-5 text-left">
            <ChannelAvatar channelName={duplicateChannel.channelName} channelSlug={duplicateChannel.slug} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[20px] font-semibold text-foreground">
                {duplicateChannel.channelName}
              </p>
              <p className="truncate text-[14px] text-muted-foreground">
                {duplicateChannel.totalVideos} videos · last scanned {new Date(duplicateChannel.scanDate).toLocaleDateString()}
              </p>
            </div>
            <span className="rounded-[8px] bg-success/10 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-success">
              Ready
            </span>
          </AppPanel>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={`/app/channels/${duplicateChannel.slug}`}>Open Existing Channel</Link>
            </Button>
            <Button variant="outline" size="lg" onClick={() => queueScan(channelUrl)} disabled={isPending}>
              {isPending ? "Queueing rescan..." : "Rescan Channel"}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-8">
        <div className="space-y-2">
          <p className="text-[13px] uppercase tracking-[0.08em] text-muted-foreground">New scan</p>
          <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
            Scan a new channel
          </h1>
          <p className="max-w-[760px] text-[15px] leading-7 text-muted-foreground">
            Paste a YouTube channel URL and queue a fresh ingest job for metadata, transcripts,
            thumbnails, and visual analysis.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,760px)_280px]">
          <AppPanel className="grid gap-6 px-8 py-8">
            <form onSubmit={handleSubmit} className="grid gap-5">
              <label className="grid gap-3">
                <span className="text-[15px] font-medium text-foreground">Channel URL</span>
                <Input
                  value={channelUrl}
                  onChange={(event) => setChannelUrl(event.target.value)}
                  placeholder="https://www.youtube.com/@codie_sanchez"
                  type="url"
                />
              </label>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="lg" disabled={isPending}>
                  {isPending ? "Queueing scan..." : "Start Scan"}
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/app/channels">Back to Channels</Link>
                </Button>
              </div>
            </form>
          </AppPanel>

          <div className="space-y-4">
            <AppPanel className="space-y-3 px-5 py-5">
              <p className="text-[14px] font-semibold text-foreground">What gets ingested</p>
              <ul className="space-y-2 text-[14px] leading-6 text-muted-foreground">
                <li>Metadata and performance history</li>
                <li>Full transcript corpus with timestamps</li>
                <li>Thumbnail images, analysis, and hook cues</li>
              </ul>
            </AppPanel>
            <AppPanel className="space-y-3 px-5 py-5">
              <p className="text-[14px] font-semibold text-foreground">Best results</p>
              <p className="text-[14px] leading-6 text-muted-foreground">
                Use the public channel URL, handle, or canonical `/@name` route. Existing
                channels are detected before you launch a full rescan.
              </p>
            </AppPanel>
          </div>
        </div>
      </div>
    </main>
  );
}
