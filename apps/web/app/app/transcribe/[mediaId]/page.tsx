"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { Download, FileAudio, FileJson, FileText, FileVideo, RefreshCw } from "lucide-react";
import { useParams } from "next/navigation";
import type {
  GenerationAssetSummary,
  UploadedMediaResponse,
  UploadedMediaSegment,
} from "@ytscan/core";
import {
  AppPanel,
  EmptyState,
  ErrorState,
} from "@/components/app/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function TranscriptSegmentRow({ segment }: { segment: UploadedMediaSegment }) {
  return (
    <div className="grid gap-2 rounded-[10px] border border-border px-4 py-3">
      <div className="flex items-center gap-3 text-[12px] font-medium text-primary">
        <span>{segment.timestampLabel}</span>
        <span className="text-muted-foreground">{formatInteger(segment.wordCount)} words</span>
      </div>
      <p className="text-[15px] leading-7 text-foreground">{segment.text}</p>
    </div>
  );
}

export default function UploadedMediaDetailPage() {
  const params = useParams<{ mediaId: string }>();
  const mediaId = params.mediaId;
  const detail = useBackendQuery<UploadedMediaResponse>(`/media/${encodeURIComponent(mediaId)}`, {
    pollMs: 5000,
  });
  const [isRetrying, startRetry] = useTransition();

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

  function handleRetry() {
    startRetry(async () => {
      await fetchBackend(`/media/${encodeURIComponent(mediaId)}/transcribe`, {
        method: "POST",
      });
      detail.refetch();
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
          actionLabel="Back to transcript archive"
          actionHref="/app/transcribe"
        />
      </main>
    );
  }

  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/app/transcribe" className="hover:text-foreground">
            Transcript Archive
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
              <div className="rounded-[12px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {media.errorMessage}
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                Transcript
              </h2>
              <p className="text-[14px] leading-6 text-muted-foreground">
                Timestamped segments you can skim, search, or export.
              </p>
            </div>
          </div>

          {media.segments.length ? (
            <div className="grid gap-3">
              {media.segments.map((segment) => (
                <TranscriptSegmentRow key={segment.id} segment={segment} />
              ))}
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
