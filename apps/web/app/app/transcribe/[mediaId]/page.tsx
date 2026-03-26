"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { Check, Copy, Download, FileAudio, FileJson, FileText, FileVideo, RefreshCw, Search, X } from "lucide-react";
import { useParams } from "next/navigation";
import type {
  GenerationAssetSummary,
  UploadedMediaResponse,
} from "@ytscan/core";
import {
  AppPanel,
  EmptyState,
  ErrorState,
} from "@/components/app/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildBackendUrl, fetchBackend, useBackendQuery } from "@/lib/backend-client";
import {
  formatDuration,
  formatInteger,
  formatRelativeDate,
  formatUploadDate,
} from "@/lib/formatters";

function formatFileSize(bytes: number | null | undefined) {
  const value = Math.max(0, bytes ?? 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mediaStatusLabel(status: string) {
  switch (status) {
    case "awaiting_upload":
      return "Awaiting upload";
    case "uploaded":
      return "Queued";
    case "transcribing":
      return "Transcribing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function mediaStatusVariant(status: string): "secondary" | "success" | "destructive" {
  if (status === "completed") return "success";
  if (status === "failed") return "destructive";
  return "secondary";
}

function progressPercent(progress: number | null | undefined) {
  return Math.max(0, Math.min(100, Math.round((progress ?? 0) * 100)));
}

function assetIconForKind(kind: string) {
  if (kind.endsWith("srt") || kind.endsWith("vtt")) {
    return <FileText className="size-4" />;
  }
  if (kind.endsWith("json")) {
    return <FileJson className="size-4" />;
  }
  return <FileText className="size-4" />;
}

function TranscriptAssetLink({ asset }: { asset: GenerationAssetSummary }) {
  return (
    <a
      href={buildBackendUrl(asset.downloadPath)}
      className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3 text-left transition-colors hover:bg-secondary"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          {assetIconForKind(asset.assetKind)}
        </div>
        <div>
          <p className="text-[14px] font-medium text-foreground">{asset.fileName}</p>
          <p className="text-[12px] text-muted-foreground">{asset.mimeType}</p>
        </div>
      </div>
      <Download className="size-4 text-muted-foreground" />
    </a>
  );
}

function HighlightedTranscript({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const pattern = new RegExp(`(${escapeRegExp(query.trim())})`, "ig");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded-[4px] bg-primary/12 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        )
      )}
    </>
  );
}

export default function UploadedMediaDetailPage() {
  const params = useParams<{ mediaId: string }>();
  const mediaId = params.mediaId;
  const detail = useBackendQuery<UploadedMediaResponse>(`/media/${encodeURIComponent(mediaId)}`, {
    pollMs: 5000,
  });
  const [isRetrying, startRetry] = useTransition();
  const [isCopying, startCopy] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  const media = detail.data?.media ?? null;
  const latestJob = media?.latestJob ?? null;
  const percent = progressPercent(latestJob?.progress);
  const isActive =
    media?.status === "awaiting_upload" ||
    media?.status === "uploaded" ||
    media?.status === "transcribing";
  const sourceHref = media?.sourceDownloadPath ? buildBackendUrl(media.sourceDownloadPath) : null;

  const primaryAssetLinks = useMemo(
    () =>
      (media?.transcriptAssets ?? []).filter((asset) =>
        ["transcript_text", "transcript_srt", "transcript_vtt", "transcript_json"].includes(asset.assetKind)
      ),
    [media?.transcriptAssets]
  );

  const filteredSegments = useMemo(() => {
    const segments = media?.segments ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return segments;
    return segments.filter((segment) => {
      const haystack = `${segment.timestampLabel} ${segment.text}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [media?.segments, searchQuery]);

  const transcriptText = media?.segments.map((segment) => segment.text).join("\n") ?? "";
  const transcriptWithTimestamps =
    media?.segments
      .map((segment) => `${segment.timestampLabel} ${segment.text}`)
      .join("\n") ?? "";

  function handleRetry() {
    startRetry(async () => {
      setRetryFeedback(null);
      try {
        await fetchBackend(`/media/${encodeURIComponent(mediaId)}/transcribe`, {
          method: "POST",
        });
        setRetryFeedback("Retry queued. The worker will pick this file up again automatically.");
        detail.refetch();
      } catch (error) {
        setRetryFeedback(error instanceof Error ? error.message : "Retry failed.");
      }
    });
  }

  function copyTranscript(kind: "plain" | "timestamps") {
    const text = kind === "timestamps" ? transcriptWithTimestamps : transcriptText;
    if (!text.trim()) return;

    startCopy(async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopyState("copied");
        window.setTimeout(() => setCopyState("idle"), 2200);
      } catch {
        setCopyState("error");
        window.setTimeout(() => setCopyState("idle"), 2200);
      }
    });
  }

  if (detail.error) {
    return (
      <main className="app-page py-8">
        <ErrorState
          title="Transcript unavailable"
          description="The app could not load this uploaded media item. Retry the request to pull the latest worker state."
          action={<Button onClick={() => detail.refetch()}>Retry</Button>}
        />
      </main>
    );
  }

  if (detail.isLoading && !media) {
    return (
      <main className="app-page py-8">
        <div className="grid gap-6">
          <AppPanel className="h-[180px]" />
          <AppPanel className="h-[220px]" />
          <AppPanel className="h-[500px]" />
        </div>
      </main>
    );
  }

  if (!media) {
    return (
      <main className="app-page py-8">
        <EmptyState
          title="Media not found"
          description="We couldn't find that uploaded file in your workspace."
          actionLabel="Back to archive"
          actionHref="/app/archive"
        />
      </main>
    );
  }

  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/app/archive" className="hover:text-foreground">
            Archive
          </Link>
          <span>/</span>
          <span className="text-foreground">{media.fileName}</span>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <AppPanel className="grid gap-5 px-7 py-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                  {media.mimeType.startsWith("audio/") ? (
                    <FileAudio className="size-5" />
                  ) : (
                    <FileVideo className="size-5" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-display text-[34px] font-semibold tracking-[-0.04em] text-foreground">
                      {media.fileName}
                    </h1>
                    <Badge variant={mediaStatusVariant(media.status)}>
                      {mediaStatusLabel(media.status)}
                    </Badge>
                  </div>
                  <p className="text-[14px] text-muted-foreground">
                    Uploaded {formatUploadDate(media.createdAt)} · {formatFileSize(media.fileSizeBytes)}
                    {media.durationSec ? ` · ${formatDuration(media.durationSec)}` : ""}
                    {media.language ? ` · ${media.language.toUpperCase()}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {sourceHref ? (
                  <Button asChild variant="outline">
                    <a href={sourceHref}>
                      <Download className="size-4" />
                      Source file
                    </a>
                  </Button>
                ) : null}
                {media.status === "failed" ? (
                  <Button onClick={handleRetry} disabled={isRetrying}>
                    <RefreshCw className="size-4" />
                    {isRetrying ? "Retrying..." : "Retry"}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <AppPanel className="px-5 py-4">
                <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Words</p>
                <p className="mt-2 font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                  {formatInteger(media.transcriptWordCount)}
                </p>
              </AppPanel>
              <AppPanel className="px-5 py-4">
                <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Segments</p>
                <p className="mt-2 font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                  {formatInteger(media.segmentCount)}
                </p>
              </AppPanel>
              <AppPanel className="px-5 py-4">
                <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Finished</p>
                <p className="mt-2 text-[15px] font-medium text-foreground">
                  {media.transcribedAt ? formatRelativeDate(media.transcribedAt) : "Not yet"}
                </p>
              </AppPanel>
            </div>

            {isActive && latestJob ? (
              <AppPanel className="grid gap-3 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[16px] font-medium text-foreground">
                    {latestJob.stage === "extracting_audio" ? "Extracting audio" : "Running Whisper"}
                  </p>
                  <span className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                    {percent}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
                </div>
                <p className="text-[14px] text-muted-foreground">
                  {latestJob.message ?? "The worker is processing the source file."}
                </p>
              </AppPanel>
            ) : null}

            {media.status === "failed" && media.errorMessage ? (
              <AppPanel className="grid gap-4 border-destructive/20 bg-destructive/5 px-5 py-5">
                <div className="space-y-1">
                  <p className="text-[15px] font-medium text-destructive">Transcription failed</p>
                  <p className="text-[14px] leading-6 text-destructive/90">
                    {media.errorMessage}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleRetry} disabled={isRetrying}>
                    <RefreshCw className="size-4" />
                    {isRetrying ? "Retrying..." : "Retry transcription"}
                  </Button>
                  <p className="text-[13px] text-muted-foreground">
                    No re-upload needed. The worker will reuse the existing source file.
                  </p>
                </div>
              </AppPanel>
            ) : null}
            {retryFeedback ? (
              <div className="rounded-[12px] border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground">
                {retryFeedback}
              </div>
            ) : null}
          </AppPanel>

          <AppPanel className="grid content-start gap-4 px-5 py-5">
            <div>
              <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Exports</p>
              <p className="mt-1 text-[14px] leading-6 text-muted-foreground">
                Download the transcript in plain text, subtitles, or JSON.
              </p>
            </div>
            <div className="grid gap-3">
              <Button
                variant="outline"
                onClick={() => copyTranscript("plain")}
                disabled={!transcriptText.trim() || isCopying}
              >
                {copyState === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copyState === "copied" ? "Copied transcript" : "Copy transcript"}
              </Button>
              <Button
                variant="outline"
                onClick={() => copyTranscript("timestamps")}
                disabled={!transcriptWithTimestamps.trim() || isCopying}
              >
                <Copy className="size-4" />
                Copy with timestamps
              </Button>
              {copyState === "error" ? (
                <p className="text-[12px] text-destructive">Clipboard access failed. Download the TXT export instead.</p>
              ) : null}
            </div>
            {primaryAssetLinks.length ? (
              <div className="grid gap-3">
                {primaryAssetLinks.map((asset) => (
                  <TranscriptAssetLink key={asset.id} asset={asset} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Exports will appear here once transcription completes.</p>
            )}
          </AppPanel>
        </section>

        <section className="grid gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                Transcript
              </h2>
              <p className="text-[14px] leading-6 text-muted-foreground">
                Timestamped segments you can skim, search, or export.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:max-w-[420px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search within this transcript"
                  className="pl-10 pr-11"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[8px] p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Clear transcript search"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <p className="text-[12px] text-muted-foreground">
                {searchQuery.trim()
                  ? `${formatInteger(filteredSegments.length)} matching segment${filteredSegments.length === 1 ? "" : "s"}`
                  : `${formatInteger(media.segments.length)} total segment${media.segments.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          {media.segments.length ? (
            <div className="grid gap-3">
              {filteredSegments.length ? (
                filteredSegments.map((segment) => (
                  <div key={segment.id} className="grid gap-2 rounded-[10px] border border-border px-4 py-3">
                    <div className="flex items-center gap-3 text-[12px] font-medium text-primary">
                      <span>{segment.timestampLabel}</span>
                      <span className="text-muted-foreground">{formatInteger(segment.wordCount)} words</span>
                    </div>
                    <p className="text-[15px] leading-7 text-foreground">
                      <HighlightedTranscript text={segment.text} query={searchQuery} />
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No transcript matches"
                  description="Try a different phrase or clear the search to return to the full transcript."
                />
              )}
            </div>
          ) : media.status === "completed" ? (
            <EmptyState
              title="Transcript unavailable"
              description="The job finished, but no transcript segments were saved for this file."
            />
          ) : (
            <AppPanel className="flex min-h-[280px] items-center justify-center px-6 py-10 text-center">
              <div className="space-y-2">
                <h3 className="font-display text-[30px] font-semibold tracking-[-0.04em] text-foreground">
                  Waiting on transcription
                </h3>
                <p className="max-w-[520px] text-[15px] leading-7 text-muted-foreground">
                  Once the worker finishes, the full transcript and timestamped segments will render here automatically.
                </p>
              </div>
            </AppPanel>
          )}
        </section>
      </div>
    </main>
  );
}
