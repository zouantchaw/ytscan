"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppTopNav } from "@/components/app/app-top-nav";
import { AppPanel } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchBackend } from "@/lib/backend-client";

export default function NewScanPage() {
  const router = useRouter();
  const [channelUrl, setChannelUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("ytscan:first-channel-url") ?? "";
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!channelUrl.trim()) {
      setError("Paste a YouTube channel URL to start a scan.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetchBackend<{ job: { jobId: string } }>("/scan", {
        method: "POST",
        body: JSON.stringify({ channelUrl: channelUrl.trim() }),
      });
      router.push(`/app/scans/${response.job.jobId}`);
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppTopNav backHref="/app/channels" backLabel="Back to Channels" />
      <main className="app-page py-16">
        <div className="mx-auto max-w-[760px]">
          <AppPanel className="grid gap-6 px-8 py-8">
            <div className="space-y-2">
              <h1 className="font-display text-[42px] font-semibold tracking-[-0.05em] text-foreground">
                Scan a new channel
              </h1>
              <p className="text-[15px] leading-7 text-muted-foreground">
                Paste a YouTube channel URL and queue a fresh ingest job for metadata, transcripts, and thumbnails.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Channel URL</span>
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
                  <Link href="/app/channels">Cancel</Link>
                </Button>
              </div>
            </form>
          </AppPanel>
        </div>
      </main>
    </div>
  );
}
