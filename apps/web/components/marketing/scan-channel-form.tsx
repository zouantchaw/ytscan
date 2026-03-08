"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function isValidYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)youtube\.com$/i.test(url.hostname) || /(^|\.)youtu\.be$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function ScanChannelForm() {
  const router = useRouter();
  const [channelUrl, setChannelUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextValue = channelUrl.trim();
    if (!isValidYouTubeUrl(nextValue)) {
      setError("Paste a valid YouTube channel or video URL to start.");
      return;
    }

    setError(null);
    startTransition(() => {
      router.push(`/sign-up?channelUrl=${encodeURIComponent(nextValue)}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[600px]">
      <div className="hero-shadow flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-1.5 sm:flex-row sm:items-center sm:gap-3 sm:pl-6 sm:pr-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 pt-2 sm:px-0 sm:pt-0">
          <Search className="size-5 text-muted-foreground" />
          <Input
            value={channelUrl}
            onChange={(event) => setChannelUrl(event.target.value)}
            type="url"
            inputMode="url"
            placeholder="Paste a YouTube channel URL..."
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            aria-label="YouTube channel URL"
          />
        </div>
        <Button type="submit" size="pill" className="w-full sm:w-auto" disabled={isPending}>
          {isPending ? "Opening" : "Scan Channel"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
