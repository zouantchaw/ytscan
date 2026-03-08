"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { ChannelDashboard, HookLibraryResponse, HookSummary } from "@ytscan/core";
import { AppPanel, EmptyState } from "@/components/app/app-ui";
import { useBackendQuery } from "@/lib/backend-client";
import { formatCompactNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function humanizeHookType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getHookTone(index: number, bestIndex: number) {
  if (index === bestIndex) return "bg-primary text-white";
  if (index === 1) return "bg-[#E8F3EC] text-success";
  return "bg-secondary text-muted-foreground";
}

function getPercentile(rank: number, total: number) {
  return Math.max(1, Math.round((rank / Math.max(total, 1)) * 100));
}

export default function HookLibraryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const channel = useBackendQuery<ChannelDashboard>(`/channels/${encodeURIComponent(slug)}`);
  const hookLibrary = useBackendQuery<HookLibraryResponse>(
    `/hooks/${encodeURIComponent(slug)}?sort=views`
  );

  const hookTypes = useMemo(() => {
    return Array.from(
      new Set((hookLibrary.data?.items ?? []).map((hook) => hook.hookType).filter(Boolean))
    );
  }, [hookLibrary.data?.items]);

  const visibleHooks = useMemo(() => {
    const items = hookLibrary.data?.items ?? [];
    return activeFilter === "all"
      ? items
      : items.filter((hook) => hook.hookType === activeFilter);
  }, [activeFilter, hookLibrary.data?.items]);

  const patternStats = useMemo(() => {
    const items = hookLibrary.data?.items ?? [];
    const grouped = hookTypes.map((hookType) => {
      const matches = items.filter((hook) => hook.hookType === hookType);
      const averageViews =
        matches.reduce((sum, hook) => sum + hook.viewCount, 0) / Math.max(matches.length, 1);
      return {
        hookType,
        averageViews,
      };
    });
    const maxViews = Math.max(...grouped.map((group) => group.averageViews), 1);
    return grouped.map((group) => ({
      ...group,
      score: Math.round((group.averageViews / maxViews) * 100),
    }));
  }, [hookLibrary.data?.items, hookTypes]);

  const bestPatternIndex = patternStats.reduce(
    (bestIndex, entry, index, entries) =>
      entries[index].score > (entries[bestIndex]?.score ?? 0) ? index : bestIndex,
    0
  );
  const bestPattern = patternStats[bestPatternIndex];

  return (
    <main className="app-page py-9">
      <div className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-6">
          <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h1 className="font-display text-[30px] font-semibold tracking-[-0.04em] text-foreground">
                Hook Library
              </h1>
              <p className="text-sm text-muted-foreground">
                First 60 seconds of every video, ranked by performance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={cn(
                  "rounded-[6px] px-3 py-1.5 text-[12px] font-medium",
                  activeFilter === "all"
                    ? "bg-foreground text-white"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                All
              </button>
              {hookTypes.map((hookType) => (
                <button
                  key={hookType}
                  type="button"
                  onClick={() => setActiveFilter(hookType)}
                  className={cn(
                    "rounded-[6px] px-3 py-1.5 text-[12px] font-medium",
                    activeFilter === hookType
                      ? "bg-foreground text-white"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {humanizeHookType(hookType)}
                </button>
              ))}
            </div>
          </section>

          {visibleHooks.length ? (
            <section className="grid gap-3">
              {visibleHooks.slice(0, 12).map((hook, index) => (
                <HookCard
                  key={`${hook.youtubeId}-${hook.startTime}`}
                  hook={hook}
                  rank={index + 1}
                  total={visibleHooks.length}
                  slug={slug}
                />
              ))}
            </section>
          ) : (
            <EmptyState
              title="No hooks found"
              description="This channel does not have enough hook data yet for the selected filter."
            />
          )}
        </div>

        <aside className="grid gap-5">
          <AppPanel className="grid gap-4 px-5 py-5">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">
              Hook Patterns
            </h2>
            <div className="grid gap-3">
              {patternStats.map((entry, index) => (
                <div key={entry.hookType} className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-foreground">{humanizeHookType(entry.hookType)}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-[60px] rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          index === bestPatternIndex
                            ? "bg-primary"
                            : index === 1
                              ? "bg-success"
                              : "bg-muted-foreground"
                        )}
                        style={{ width: `${entry.score}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        index === bestPatternIndex
                          ? "text-primary"
                          : index === 1
                            ? "text-success"
                            : "text-muted-foreground"
                      )}
                    >
                      {entry.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground">
              % = normalized performance score based on average views for each hook type.
            </p>
          </AppPanel>

          <AppPanel className="grid gap-3 bg-accent px-5 py-5">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">
              Insight
            </h2>
            <p className="text-[13px] leading-6 text-muted-foreground">
              {bestPattern
                ? `${humanizeHookType(bestPattern.hookType)} hooks are leading on ${channel.data?.channelName ?? "this channel"}, with the strongest average performance signal in the library.`
                : "As hook data accumulates, this panel will highlight the top opening pattern for the channel."}
            </p>
          </AppPanel>
        </aside>
      </div>
    </main>
  );
}

function HookCard({
  hook,
  rank,
  total,
  slug,
}: {
  hook: HookSummary;
  rank: number;
  total: number;
  slug: string;
}) {
  const percentile = getPercentile(rank, total);

  return (
    <AppPanel className="flex gap-4 px-5 py-5">
      <div className="flex w-12 shrink-0 flex-col items-center gap-0.5">
        <span className={cn("font-display text-[24px] font-bold leading-none", rank === 1 ? "text-primary" : "text-foreground")}>
          #{rank}
        </span>
        <span className="text-[10px] text-muted-foreground">{formatCompactNumber(hook.viewCount)}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/channels/${slug}/videos/${hook.youtubeId}`}
            className="text-[14px] font-semibold text-foreground hover:text-primary"
          >
            {hook.videoTitle}
          </Link>
          <span
            className={cn(
              "rounded-[4px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
              getHookTone(rank - 1, 0)
            )}
          >
            {humanizeHookType(hook.hookType)}
          </span>
        </div>
        <p className="text-[13px] leading-7 text-muted-foreground">&ldquo;{hook.text}&rdquo;</p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>{hook.timestampLabel}</span>
          <span>{formatCompactNumber(hook.viewCount)} views</span>
          <span className={rank <= 3 ? "text-success" : "text-muted-foreground"}>Top {percentile}%</span>
        </div>
      </div>
    </AppPanel>
  );
}
