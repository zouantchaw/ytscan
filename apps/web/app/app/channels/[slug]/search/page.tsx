"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Search as SearchIcon } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { ChannelDashboard, SearchResponse } from "@ytscan/core";
import { AppPanel, TierBadge, VideoThumbnail } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackendQuery } from "@/lib/backend-client";
import { getDefaultSearchPrompt } from "@/lib/channel-ui";
import { formatCompactNumber } from "@/lib/formatters";

function FilterChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[8px] border border-border px-4 py-1.5 text-[13px] text-muted-foreground">
      {children}
    </span>
  );
}

function SearchStateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <AppPanel className="flex min-h-[652px] flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-secondary">
        <SearchIcon className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-3">
        <h2 className="font-display text-[34px] font-semibold tracking-[-0.04em] text-foreground">
          {title}
        </h2>
        <p className="mx-auto max-w-[440px] text-[15px] leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </AppPanel>
  );
}

export default function ChannelSearchPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const channel = useBackendQuery<ChannelDashboard>(`/channels/${encodeURIComponent(slug)}`);
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

  const creatorName = channel.data?.channelName?.split(" ")[0] ?? "this creator";
  const suggestions = [
    defaultQuery,
    ...(channel.data?.topicClusters.slice(0, 2).map((topic) => `What has ${creatorName} said about ${topic.topic}?`) ??
      []),
  ];
  const resultItems = results.data?.items ?? [];

  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-6">
        <section className="space-y-4">
          <div className="space-y-2">
            <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
              Semantic Search
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              Search across all scanned transcripts using natural language.
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-12 items-center gap-3 rounded-[14px] border border-border bg-card px-4"
          >
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={defaultQuery}
              className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            <Button type="submit" variant="ghost" disabled={isPending} className="text-[14px] font-medium">
              {isPending ? "Searching..." : "Search"}
            </Button>
          </form>
        </section>

        {!hasQuery ? (
          <SearchStateCard
            title="Search transcripts, hooks, and topics"
            description="Ask a question in plain English to surface the exact moments this creator has covered the topic."
            action={
              <div className="flex flex-wrap justify-center gap-3">
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
            }
          />
        ) : results.error ? (
          <SearchStateCard
            title="Search unavailable right now"
            description="We hit a backend error while searching this channel. Retry the query or refine the wording and try again."
            action={<Button onClick={() => results.refetch()}>Retry Search</Button>}
          />
        ) : resultItems.length ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <FilterChip>Semantic</FilterChip>
              <FilterChip>{channel.data?.channelName ?? "Current channel"}</FilterChip>
              <FilterChip>{results.data?.videoCount ?? 0} videos</FilterChip>
              <span>{results.data?.count ?? 0} results</span>
            </div>

            <section className="grid gap-3">
              {resultItems.map((item) => (
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
                      {item.score ? <span>Relevance: {item.score.toFixed(2)}</span> : null}
                    </div>
                  </div>
                </AppPanel>
              ))}
            </section>
          </>
        ) : (
          <SearchStateCard
            title="No matches yet"
            description="Try broadening the topic, using a different wording, or searching for a more concrete business, hook, or claim."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setInputValue("");
                  router.replace(`/app/channels/${slug}/search`);
                }}
              >
                Clear search
              </Button>
            }
          />
        )}
      </div>
    </main>
  );
}
