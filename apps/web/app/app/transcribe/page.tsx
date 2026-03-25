"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, FileVideo, RefreshCw, UploadCloud, X } from "lucide-react";
import type {
  UploadedMediaCreateResponse,
  UploadedMediaListResponse,
  UploadedMediaSummary,
} from "@ytscan/core";
import {
  AppPanel,
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/app/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackendError, fetchBackend, useBackendQuery } from "@/lib/backend-client";
import {
  formatDuration,
  formatInteger,
  formatRelativeDate,
} from "@/lib/formatters";

const MAX_UPLOAD_MB = 95;

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

function mediaStatusDetail(media: UploadedMediaSummary) {
  if (media.status === "completed") {
    return `${formatInteger(media.transcriptWordCount)} words · ${media.segmentCount} timestamped segments`;
  }

  if (media.status === "failed") {
    return media.errorMessage ?? "The transcription job failed. Open it to retry.";
  }

  if (media.status === "transcribing") {
    return media.latestJob?.message ?? "Worker is extracting audio and running Whisper.";
  }

  if (media.status === "uploaded") {
    return "Upload received. Waiting for the transcription worker.";
  }

  return "Start by uploading a source file.";
}

function UploadedMediaCard({ media }: { media: UploadedMediaSummary }) {
  const icon =
    media.mimeType.startsWith("audio/") ? (
      <AudioLines className="size-5 text-primary" />
    ) : (
      <FileVideo className="size-5 text-primary" />
    );

  return (
    <Link href={`/app/transcribe/${media.id}`} className="block">
      <AppPanel className="grid gap-4 px-5 py-5 transition-transform duration-200 hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-[12px] bg-primary/10">
              {icon}
            </div>
            <div className="space-y-1">
              <p className="text-[16px] font-semibold text-foreground">{media.fileName}</p>
              <p className="text-[13px] text-muted-foreground">
                {formatFileSize(media.fileSizeBytes)}
                {media.durationSec ? ` · ${formatDuration(media.durationSec)}` : ""}
                {media.language ? ` · ${media.language.toUpperCase()}` : ""}
              </p>
            </div>
          </div>
          <Badge variant={mediaStatusVariant(media.status)}>{mediaStatusLabel(media.status)}</Badge>
        </div>
        <p className="text-[14px] leading-6 text-muted-foreground">{mediaStatusDetail(media)}</p>
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
          <span>Added {formatRelativeDate(media.createdAt)}</span>
          {media.transcribedAt ? <span>Finished {formatRelativeDate(media.transcribedAt)}</span> : null}
        </div>
      </AppPanel>
    </Link>
  );
}

export default function TranscribePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploads = useBackendQuery<UploadedMediaListResponse>("/media", {
    pollMs: 5000,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const activeCount = useMemo(
    () =>
      uploads.data?.items.filter((item) =>
        ["awaiting_upload", "uploaded", "transcribing"].includes(item.status)
      ).length ?? 0,
    [uploads.data?.items]
  );

  function selectFile(nextFile: File | null) {
    setSelectedFile(nextFile);
    setUploadError(null);
    setUploadSuccess(null);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleDragState(event: React.DragEvent<HTMLDivElement>, nextDragging: boolean) {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    setIsDragging(nextDragging);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    setIsDragging(false);
    const nextFile = event.dataTransfer.files?.[0] ?? null;
    selectFile(nextFile);
  }

  async function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      if (selectedFile.size > MAX_UPLOAD_MB * 1024 * 1024) {
        throw new Error(`Files must be ${MAX_UPLOAD_MB} MB or smaller.`);
      }

      const created = await fetchBackend<UploadedMediaCreateResponse>("/media", {
        method: "POST",
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          fileSizeBytes: selectedFile.size,
        }),
      });

      const uploadResponse = await fetch(created.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": selectedFile.type || "application/octet-stream",
        },
        body: selectedFile,
      });

      const uploadPayload = await uploadResponse
        .json()
        .catch(() => null);
      if (!uploadResponse.ok) {
        const message =
          uploadPayload && typeof uploadPayload === "object" && "error" in uploadPayload
            ? String((uploadPayload as { error?: unknown }).error ?? "Upload failed")
            : "Upload failed";
        throw new Error(message);
      }

      setUploadSuccess(`Uploaded ${selectedFile.name}. Transcription has started.`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      uploads.refetch();
      router.push(`/app/transcribe/${created.media.id}`);
    } catch (error) {
      if (error instanceof BackendError) {
        setUploadError(error.message);
      } else if (error instanceof Error) {
        setUploadError(error.message);
      } else {
        setUploadError("Upload failed.");
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <AppPanel className="grid gap-6 px-7 py-7">
            <div className="space-y-2">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Video Transcription
              </p>
              <h1 className="font-display text-[44px] font-semibold tracking-[-0.05em] text-foreground">
                Upload a video. Get a clean transcript.
              </h1>
              <p className="max-w-[720px] text-[15px] leading-7 text-muted-foreground">
                Drop in a source file, let the worker run Whisper, then search, review, and export the transcript with timestamps.
              </p>
            </div>

            <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleUploadSubmit}>
              <div className="grid gap-3">
                <label className="text-[15px] font-medium text-foreground" htmlFor="transcribe-upload">
                  Source file
                </label>
                <div
                  className={[
                    "grid min-h-[180px] gap-4 rounded-[16px] border border-dashed px-5 py-5 transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-secondary/40 hover:border-primary/40 hover:bg-secondary/70",
                    isUploading ? "opacity-70" : "",
                  ].join(" ")}
                  onDragEnter={(event) => handleDragState(event, true)}
                  onDragOver={(event) => handleDragState(event, true)}
                  onDragLeave={(event) => handleDragState(event, false)}
                  onDrop={handleDrop}
                >
                  <input
                    id="transcribe-upload"
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*"
                    className="sr-only"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] ?? null;
                      selectFile(nextFile);
                    }}
                  />
                  <div className="grid gap-2">
                    <div className="flex size-12 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                      <UploadCloud className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[15px] font-medium text-foreground">
                        Drag and drop a video or audio file
                      </p>
                      <p className="text-[13px] leading-6 text-muted-foreground">
                        MP4, MOV, MP3, WAV, M4A, and similar formats up to {MAX_UPLOAD_MB} MB.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" onClick={openFilePicker} disabled={isUploading}>
                      Choose file
                    </Button>
                    <p className="text-[13px] text-muted-foreground">
                      The file stays private to your workspace.
                    </p>
                  </div>

                  {selectedFile ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-card px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-[14px] font-medium text-foreground">{selectedFile.name}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                          {selectedFile.type ? ` · ${selectedFile.type}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove selected file"
                        onClick={() => {
                          selectFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-end">
                <Button type="submit" size="lg" disabled={!selectedFile || isUploading}>
                  <UploadCloud className="size-4" />
                  {isUploading ? "Uploading..." : "Upload & Transcribe"}
                </Button>
              </div>
            </form>

            {uploadError ? (
              <div className="rounded-[12px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {uploadError}
              </div>
            ) : null}
            {uploadSuccess ? (
              <div className="rounded-[12px] border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
                {uploadSuccess}
              </div>
            ) : null}
          </AppPanel>

          <AppPanel className="grid gap-5 px-6 py-6">
            <div className="space-y-1">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Queue Health
              </p>
              <p className="font-display text-[32px] font-semibold tracking-[-0.04em] text-foreground">
                {activeCount}
              </p>
              <p className="text-sm text-muted-foreground">
                active transcription job{activeCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Uploads are stored privately in your workspace.</p>
              <p>Completed transcripts include full text plus timestamped segments, TXT, SRT, VTT, and JSON exports.</p>
              <p>Failed jobs can be retried from the transcript detail page without re-uploading the source file.</p>
              <Button variant="outline" onClick={() => uploads.refetch()}>
                <RefreshCw className="size-4" />
                Refresh archive
              </Button>
            </div>
          </AppPanel>
        </section>

        <section className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                Transcript Archive
              </h2>
              <p className="text-[14px] leading-6 text-muted-foreground">
                Every uploaded media file and its latest transcription state.
              </p>
            </div>
          </div>

          {uploads.isLoading ? (
            <PageLoading cards={4} className="xl:grid-cols-2" />
          ) : uploads.error ? (
            <ErrorState
              title="Transcript archive unavailable"
              description="The app could not load your uploaded media. Retry the request to refresh the latest transcription state."
              action={<Button onClick={() => uploads.refetch()}>Retry</Button>}
            />
          ) : uploads.data?.items.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {uploads.data.items.map((media) => (
                <UploadedMediaCard key={media.id} media={media} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No uploads yet"
              description="Upload your first source file to build a searchable transcript archive."
            />
          )}
        </section>
      </div>
    </main>
  );
}
