"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  ChannelDashboard,
  ChannelOpportunity,
  ChannelOpportunitiesResponse,
  PersonaModelListResponse,
  ScriptProjectResponse,
} from "@ytscan/core";
import {
  AppPanel,
  ChannelAvatar,
  EmptyState,
  ErrorState,
} from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";
import { formatCompactNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const opportunityTypeLabels: Record<ChannelOpportunity["opportunityType"], string> = {
  repeat_winner: "Repeat winner",
  adjacent_whitespace: "Whitespace",
  contrarian_take: "Contrarian take",
};

function OpportunityLoadingState() {
  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1140px] grid gap-6">
        <div className="space-y-2">
          <Skeleton className="h-14 w-[360px] rounded-[14px]" />
          <Skeleton className="h-6 w-[620px] max-w-full rounded-full" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <AppPanel key={index} className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
              <Skeleton className="h-10 w-[560px] max-w-full rounded-[12px]" />
              <Skeleton className="h-5 w-full rounded-full" />
              <Skeleton className="h-5 w-[94%] rounded-full" />
              <Skeleton className="h-5 w-[88%] rounded-full" />
            </div>
            <div className="grid gap-3">
              <Skeleton className="h-40 w-full rounded-[12px]" />
              <Skeleton className="h-11 w-full rounded-[12px]" />
            </div>
          </AppPanel>
        ))}
      </div>
    </main>
  );
}

function EvidenceList({
  title,
  items,
}: {
  title: string;
  items: ChannelOpportunity["channelEvidence"];
}) {
  if (!items.length) return null;

  return (
    <div className="grid gap-2">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-2">
        {items.map((item) => (
          <div
            key={`${title}-${item.title}-${item.detail}`}
            className="rounded-[10px] border border-border bg-background px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-medium text-foreground">{item.title}</p>
              {item.supportingMetric ? (
                <span className="text-[12px] font-medium text-primary">{item.supportingMetric}</span>
              ) : null}
            </div>
            <p className="mt-1 text-[14px] leading-6 text-muted-foreground">{item.detail}</p>
            {item.href ? (
              <Link
                href={item.href}
                target="_blank"
                className="mt-2 inline-flex text-[13px] font-medium text-primary hover:text-primary/80"
              >
                Open source →
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpportunityCard({
  opportunity,
  channelName,
  personaReady,
  isPending,
  isActive,
  onBuildPackage,
}: {
  opportunity: ChannelOpportunity;
  channelName: string;
  personaReady: boolean;
  isPending: boolean;
  isActive: boolean;
  onBuildPackage: (opportunity: ChannelOpportunity) => void;
}) {
  return (
    <AppPanel className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_304px]">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary-foreground">
            {opportunity.scoreLabel}
          </span>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {opportunityTypeLabels[opportunity.opportunityType]}
          </span>
          <span className="text-[13px] font-medium text-muted-foreground">
            Score {opportunity.score}
          </span>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-[34px] font-semibold tracking-[-0.05em] text-foreground">
            {opportunity.title}
          </h2>
          <p className="text-[17px] leading-8 text-foreground">{opportunity.angle}</p>
          <p className="text-[15px] leading-7 text-muted-foreground">{opportunity.rationale}</p>
          <p className="text-[15px] leading-7 text-muted-foreground">
            <span className="font-medium text-foreground">Why now:</span> {opportunity.whyNow}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <EvidenceList title="Channel proof" items={opportunity.channelEvidence} />
          <EvidenceList title="Competitor proof" items={opportunity.competitorEvidence} />
        </div>
      </div>

      <div className="grid gap-4">
        <AppPanel className="grid gap-4 bg-accent/30 px-5 py-5">
          <div className="grid gap-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Recommended package
            </p>
            <p className="text-[20px] font-semibold tracking-[-0.03em] text-foreground">
              {opportunity.packageSeed.title}
            </p>
            <p className="text-[14px] leading-6 text-muted-foreground">
              {opportunity.recommendedFormat} · {opportunity.recommendedDuration}
            </p>
          </div>
          <div className="grid gap-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Hook
            </p>
            <p className="text-[14px] leading-6 text-foreground">{opportunity.recommendedHook}</p>
          </div>
          <div className="grid gap-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Thumbnail direction
            </p>
            <p className="text-[14px] leading-6 text-foreground">{opportunity.thumbnailDirection}</p>
          </div>
          <div className="rounded-[10px] border border-border bg-background px-4 py-3 text-[13px] text-muted-foreground">
            {personaReady
              ? `A ready persona model for ${channelName} will be attached automatically.`
              : "No ready persona model is attached yet. The package will use channel evidence only."}
          </div>
        </AppPanel>

        <Button
          size="lg"
          disabled={isPending}
          onClick={() => onBuildPackage(opportunity)}
          className={cn(isActive && "opacity-90")}
        >
          {isPending && isActive ? "Building package..." : "Build Package"}
        </Button>
      </div>
    </AppPanel>
  );
}

export default function ChannelOpportunitiesPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const [activeOpportunityId, setActiveOpportunityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const channel = useBackendQuery<ChannelDashboard>(`/channels/${encodeURIComponent(slug)}`);
  const opportunities = useBackendQuery<ChannelOpportunitiesResponse>(
    `/channels/${encodeURIComponent(slug)}/opportunities`
  );
  const personaModels = useBackendQuery<PersonaModelListResponse>("/persona-models");

  const activePersona =
    personaModels.data?.items.find((item) => item.channelSlug === slug && item.status === "ready") ?? null;

  async function handleBuildPackage(opportunity: ChannelOpportunity) {
    setError(null);
    setActiveOpportunityId(opportunity.id);

    startTransition(async () => {
      try {
        const created = await fetchBackend<ScriptProjectResponse>("/script-lab/projects", {
          method: "POST",
          body: JSON.stringify({
            channelSlug: slug,
            personaModelId: activePersona?.id ?? null,
            status: "draft",
            title: opportunity.packageSeed.title,
            topic: opportunity.packageSeed.topic,
            opportunity,
          }),
        });

        await fetchBackend(`/script-lab/projects/${created.project.id}/research`, {
          method: "POST",
          body: JSON.stringify({ seededFrom: "opportunity" }),
        });

        router.push(`/app/channels/${slug}/script-lab/${created.project.id}?step=research`);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to build the package.");
      } finally {
        setActiveOpportunityId(null);
      }
    });
  }

  if (channel.error || opportunities.error || personaModels.error) {
    return (
      <main className="app-page pb-10 pt-4 lg:pt-0">
        <ErrorState
          title="Opportunities unavailable"
          description="We couldn't rank next-video opportunities for this channel. Retry the page and pull the latest recommendations."
          action={
            <Button
              onClick={() => {
                channel.refetch();
                opportunities.refetch();
                personaModels.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      </main>
    );
  }

  if (!channel.data || !opportunities.data || !personaModels.data) {
    return <OpportunityLoadingState />;
  }

  const dashboard = channel.data;
  const recommendations = opportunities.data;

  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1140px] grid gap-6">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ChannelAvatar channelName={dashboard.channelName} channelSlug={slug} />
              <div className="text-sm text-muted-foreground">
                {dashboard.channelName} · {formatCompactNumber(dashboard.subscriberCount)} subscribers
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
                Best Next Videos
              </h1>
              <p className="max-w-[760px] text-[16px] leading-8 text-muted-foreground">
                Ranked opportunities based on your winners, your competitors, and the angles most likely to produce a strong first-minute package.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline">
              <Link href={`/app/channels/${slug}`}>View Analytics</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/app/channels/${slug}/compare`}>Open Compare</Link>
            </Button>
          </div>
        </section>

        <AppPanel className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="space-y-1">
            <p className="text-[14px] font-medium text-foreground">
              {recommendations.count} recommended opportunities
            </p>
            <p className="text-sm text-muted-foreground">
              Pick one and YTScan will seed research, a first-minute package, and thumbnail directions automatically.
            </p>
          </div>
          <div className="rounded-full bg-secondary px-3 py-2 text-[13px] font-medium text-muted-foreground">
            {activePersona
              ? `Persona ready: ${activePersona.baseModel}`
              : "No ready persona model attached"}
          </div>
        </AppPanel>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {recommendations.items.length ? (
          <section className="grid gap-5">
            {recommendations.items.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                channelName={dashboard.channelName}
                personaReady={Boolean(activePersona)}
                isPending={isPending}
                isActive={activeOpportunityId === opportunity.id}
                onBuildPackage={handleBuildPackage}
              />
            ))}
          </section>
        ) : (
          <EmptyState
            title="No high-signal opportunities yet"
            description="We couldn't find ranked opportunities for this channel yet. Add competitors or rescan the corpus to improve recommendation coverage."
            actionLabel="Open Compare"
            actionHref={`/app/channels/${slug}/compare`}
          />
        )}
      </div>
    </main>
  );
}
