"use client";

import { useEffect, useState, useTransition } from "react";
import { Search as SearchIcon } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type {
  ChannelDashboard,
  SearchResponse,
} from "@ytscan/core";
import Link from "next/link";
import { AppPanel, EmptyState, TierBadge, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackendQuery } from "@/lib/backend-client";
import { getDefaultSearchPrompt } from "@/lib/channel-ui";
import { formatCompactNumber } from "@/lib/formatters";

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[8px] border border-border px-4 py-1.5 text-[13px] text-muted-foreground">
      {children}
    </span>
  );
}

export default function ChannelSearchPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const channel = useBackendQuery<ChannelDashboard>(
    `/channels/${encodeURIComponent(slug)}`
  );
  const defaultQuery = getDefaultSearchPrompt(slug, channel.data?.channelName ?? "this creator");
  const submittedQuery = searchParams.get("q")?.trim() ?? "";
  const [inputValue, setInputValue] = useState(submittedQuery);
  const [isPending, startTransition] = useTransition();
  const hasQuery = Boolean(submittedQuery);
  const results = useBackendQuery<SearchResponse>(
    hasQuery
      ? `/search?channel=${encodeURIComponent(slug)}&q=${encodeURIComponent(
          submittedQuery
        )}&limit=12&mode=semantic`
      : null,
    { enabled: hasQuery }
  );

  useEffect(() => {
    setInputValue(submittedQuery);
  }, [submittedQuery]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = inputValue.trim();

    startTransition(() => {
      router.replace(
        nextQuery
          ? `/app/channels/${slug}/search?q=${encodeURIComponent(nextQuery)}`
          : `/app/channels/${slug}/search`
      );
    });
  }
  const suggestions = [
    defaultQuery,
    ...(channel.data?.topicClusters.slice(0, 2).map((topic) => `What has ${channel.data?.channelName?.split(" ")[0] ?? "this creator"} said about ${topic.topic}?`) ?? []),
  ];

  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <section className="grid gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-[32px] font-semibold tracking-[-0.04em] text-foreground">
              Semantic Search
            </h1>
            <p className="text-sm text-muted-foreground">
              Search quotes, hooks, and recurring ideas across every transcript in the channel.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 xl:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-[12px] border border-border bg-card px-4">
              <SearchIcon className="size-5 text-muted-foreground" />
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={defaultQuery}
                className="h-[44px] border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit" variant="dark" size="lg" disabled={isPending}>
              {isPending ? "Searching..." : "Search"}
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Suggested prompts:</span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setInputValue(suggestion);
                  startTransition(() => {
                    router.replace(`/app/channels/${slug}/search?q=${encodeURIComponent(suggestion)}`);
                  });
                }}
              >
                <FilterChip>{suggestion}</FilterChip>
              </button>
            ))}
          </div>

          {hasQuery ? (
            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span>
                {results.data?.count ?? 0} results across {results.data?.videoCount ?? 0} videos
              </span>
              <span>
                Sort by:{" "}
                <span className="font-medium text-foreground">
                  {results.data?.mode === "semantic" ? "Relevance" : "Views"}
                </span>
              </span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3">
          {!hasQuery ? (
            <AppPanel className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
                <SearchIcon className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-[34px] font-semibold tracking-[-0.04em] text-foreground">
                  Search transcripts, hooks, and topics
                </h2>
                <p className="max-w-[540px] text-[15px] leading-7 text-muted-foreground">
                  Ask a question in plain English to surface the exact moments this creator has covered
                  the topic.
                </p>
              </div>
            </AppPanel>
          ) : (results.data?.items ?? []).length ? (
            (results.data?.items ?? []).map((item) => {
              return (
                <AppPanel
                  key={item.vectorId}
                  className="grid gap-4 px-5 py-5 md:grid-cols-[100px_1fr]"
                >
                  <VideoThumbnail
                    youtubeId={item.youtubeId}
                    title={item.title}
                    className="h-[60px] rounded-[10px] object-cover"
                    aspect="card"
                  />
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/app/channels/${slug}/videos/${item.youtubeId}`}
                        className="text-[16px] font-semibold text-foreground hover:text-primary"
                      >
                        {item.title}
                      </Link>
                      <TierBadge tier={item.performanceTier} />
                      <span className="text-sm text-muted-foreground">
                        {formatCompactNumber(item.viewCount)} views
                      </span>
                    </div>
                    <div className="rounded-[8px] bg-background px-4 py-4">
                      <p className="border-l-[3px] border-primary pl-4 text-[15px] leading-7 text-foreground">
                        &ldquo;{item.snippet}&rdquo;
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="font-medium text-primary">{item.timestampLabel}</span>
                      {item.score ? (
                        <span>Relevance: {item.score.toFixed(2)}</span>
                      ) : null}
                    </div>
                  </div>
                </AppPanel>
              );
            })
          ) : (
            <EmptyState
              title="No matches yet"
              description="Try broadening the topic, using a different wording, or searching for a more concrete business, hook, or claim."
            />
          )}
        </section>
      </div>
    </main>
  );
}
