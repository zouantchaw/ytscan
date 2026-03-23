"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import type {
  GenerationAssetSummary,
  GenerationJobSummary,
  PersonaModelListResponse,
  ScriptLabStep,
  ScriptOutputVersion,
  ScriptProjectDetail,
  ScriptProjectResponse,
  ThumbnailBriefVersion,
} from "@ytscan/core";
import { AppPanel, ChannelAvatar, EmptyState, ErrorState } from "@/components/app/app-ui";
import {
  ScriptLabWorkflowSidebar,
  type ScriptLabViewStep,
} from "@/components/app/script-lab-workflow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildBackendUrl, fetchBackend, useBackendQuery } from "@/lib/backend-client";
import { formatCompactNumber, formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const outputStepLabels: Record<ScriptLabViewStep, string> = {
  topic_input: "Topic Input",
  research: "Research",
  hooks: "Hook Options",
  script: "Script Draft",
  director_notes: "Director's Notes",
  thumbnail_brief: "Thumbnail Review",
  previs: "Previsualization",
};

const opportunityTypeLabels = {
  repeat_winner: "Repeat winner",
  adjacent_whitespace: "Whitespace",
  contrarian_take: "Contrarian take",
} as const;

const sceneStepNames = ["Hook", "Setup", "Point 1", "Point 2", "Point 3 + CTA"];

function isViewStep(value: string | null): value is ScriptLabViewStep {
  return (
    value === "topic_input" ||
    value === "research" ||
    value === "hooks" ||
    value === "script" ||
    value === "director_notes" ||
    value === "thumbnail_brief" ||
    value === "previs"
  );
}

function parseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataBoolean(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "boolean" ? value : null;
}

function buildProjectStepHref(
  slug: string,
  projectId: string,
  step: ScriptLabViewStep,
  extras?: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams();
  params.set("step", step);
  Object.entries(extras ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `/app/channels/${slug}/script-lab/${projectId}?${params.toString()}`;
}

function findLatestOutput(
  project: ScriptProjectDetail,
  step: ScriptLabStep
): ScriptOutputVersion | ThumbnailBriefVersion | GenerationJobSummary | null {
  if (step === "thumbnail_brief") {
    return [...project.thumbnailBriefs].sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
    )[0] ?? null;
  }

  if (step === "previs") {
    return findLatestGenerationJob(project, "previs");
  }

  return [...project.outputs]
    .filter((output) => output.step === step)
    .sort((left, right) => {
      if (left.version !== right.version) return right.version - left.version;
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })[0] ?? null;
}

function findLatestGenerationJob(project: ScriptProjectDetail, jobType: string): GenerationJobSummary | null {
  return [...project.generationJobs]
    .filter((job) => job.jobType === jobType)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
}

function findJobAssets(
  project: ScriptProjectDetail,
  job: GenerationJobSummary | null,
  assetKind: string
): GenerationAssetSummary[] {
  const scopedAssets = job
    ? project.generatedAssets.filter(
        (asset) => asset.generationJobId === job.id && asset.assetKind === assetKind
      )
    : [];

  const items = scopedAssets.length
    ? scopedAssets
    : project.generatedAssets.filter((asset) => asset.assetKind === assetKind);

  return [...items].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function getDefaultStep(project: ScriptProjectDetail): ScriptLabViewStep {
  if (project.generationJobs.some((job) => job.jobType === "previs")) return "previs";
  if (project.thumbnailBriefs.length || project.generatedAssets.some((asset) => asset.assetKind === "thumbnail_image")) {
    return "thumbnail_brief";
  }
  if (project.outputs.some((output) => output.step === "director_notes")) return "director_notes";
  if (project.outputs.some((output) => output.step === "script")) return "script";
  if (project.outputs.some((output) => output.step === "hooks")) return "hooks";
  if (project.researchItems.length > 0) return "research";
  return "topic_input";
}

function getCompletedSteps(project: ScriptProjectDetail): ScriptLabViewStep[] {
  const steps: ScriptLabViewStep[] = ["topic_input"];
  if (project.researchItems.length > 0) steps.push("research");
  if (project.outputs.some((output) => output.step === "hooks")) steps.push("hooks");
  if (project.outputs.some((output) => output.step === "script")) steps.push("script");
  if (project.outputs.some((output) => output.step === "director_notes")) steps.push("director_notes");
  if (
    project.thumbnailBriefs.length > 0 ||
    project.generatedAssets.some((asset) => asset.assetKind === "thumbnail_image")
  ) {
    steps.push("thumbnail_brief");
  }
  if (
    project.generatedAssets.some((asset) => asset.assetKind === "previs_video") ||
    project.generationJobs.some((job) => job.jobType === "previs" && job.status === "completed")
  ) {
    steps.push("previs");
  }
  return steps;
}

function getThumbnailTitle(asset: GenerationAssetSummary, index: number) {
  const metadata = parseRecord(asset.metadata);
  return metadataString(metadata, "conceptTitle") ?? `Variant ${String.fromCharCode(65 + index)}`;
}

function getThumbnailSummary(asset: GenerationAssetSummary, index: number) {
  const metadata = parseRecord(asset.metadata);
  const prompt = metadataString(metadata, "prompt");
  const briefMatch = prompt?.match(/Brief:\s*([\s\S]*?)$/i)?.[1]?.trim();
  return briefMatch || asset.variant?.replace(/-/g, " ") || `Variant ${String.fromCharCode(65 + index)}`;
}

function getPrevisDurationLabel(index: number, totalScenes: number, totalDurationSeconds: number | null) {
  const duration = totalDurationSeconds && totalScenes > 0 ? Math.floor(totalDurationSeconds / totalScenes) : 30;
  const startSeconds = index * duration;
  const endSeconds = startSeconds + duration;

  function format(total: number) {
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  return `${format(startSeconds)}-${format(endSeconds)}`;
}

function Breadcrumb({
  slug,
  projectId,
  step,
}: {
  slug: string;
  projectId: string;
  step: ScriptLabViewStep;
}) {
  return (
    <div className="border-b border-separator px-6 py-3 md:px-10 xl:px-12">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span>‹</span>
        <Link href={`/app/channels/${slug}/script-lab/projects`} className="hover:text-foreground">
          Projects
        </Link>
        <span>/</span>
        <Link
          href={buildProjectStepHref(slug, projectId, step)}
          className="font-medium text-foreground"
        >
          {outputStepLabels[step]}
        </Link>
      </div>
    </div>
  );
}

function ScriptLabProjectLoadingState({ slug, projectId }: { slug: string; projectId: string }) {
  return (
    <main className="pb-10">
      <div className="border-b border-separator px-6 py-3 md:px-10 xl:px-12">
        <Skeleton className="h-4 w-40 rounded-full" />
      </div>
      <div className="flex min-h-[calc(100vh-145px)]">
        <ScriptLabWorkflowSidebar activeStep="research" channelSlug={slug} projectId={projectId} />
        <section className="flex-1 px-6 py-9 md:px-10 xl:px-12">
          <div className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28 rounded-full" />
                  <Skeleton className="h-16 w-[360px] max-w-full rounded-[14px]" />
                  <Skeleton className="h-7 w-[440px] max-w-full rounded-full" />
                </div>
                <Skeleton className="h-11 w-44 rounded-[12px]" />
              </div>
              <AppPanel className="h-[420px] px-6 py-6">
                <div className="grid gap-4">
                  <Skeleton className="h-6 w-56 rounded-full" />
                  <Skeleton className="h-5 w-full rounded-full" />
                  <Skeleton className="h-5 w-[92%] rounded-full" />
                  <Skeleton className="h-5 w-[96%] rounded-full" />
                  <Skeleton className="h-5 w-[84%] rounded-full" />
                  <Skeleton className="h-40 w-full rounded-[12px]" />
                </div>
              </AppPanel>
            </div>
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <AppPanel key={index} className="px-5 py-5">
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-32 rounded-full" />
                    <Skeleton className="h-4 w-full rounded-full" />
                    <Skeleton className="h-4 w-[80%] rounded-full" />
                    <Skeleton className="h-4 w-[68%] rounded-full" />
                  </div>
                </AppPanel>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StepOutputBody({
  output,
}: {
  output: ScriptOutputVersion | ThumbnailBriefVersion;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-card px-6 py-6">
      <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">{output.content}</div>
    </div>
  );
}

function OpportunitySummaryPanel({ project }: { project: ScriptProjectDetail }) {
  if (!project.opportunity) return null;

  const opportunity = project.opportunity;
  const channelProof = opportunity.channelEvidence[0] ?? null;
  const competitorProof = opportunity.competitorEvidence[0] ?? null;

  return (
    <AppPanel className="grid gap-4 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary-foreground">
          {opportunity.scoreLabel}
        </span>
        <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {opportunityTypeLabels[opportunity.opportunityType]}
        </span>
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
          Selected Opportunity
        </h2>
        <p className="text-[17px] font-medium leading-7 text-foreground">{opportunity.title}</p>
        <p className="text-[14px] leading-6 text-muted-foreground">{opportunity.angle}</p>
      </div>

      <div className="grid gap-3 text-sm text-muted-foreground">
        <div>
          <p className="font-medium uppercase tracking-[0.06em] text-muted-foreground">Why now</p>
          <p className="mt-1 leading-6 text-foreground">{opportunity.whyNow}</p>
        </div>

        {channelProof ? (
          <div>
            <p className="font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Channel proof
            </p>
            <p className="mt-1 leading-6 text-foreground">
              {channelProof.title}
              {channelProof.supportingMetric ? ` · ${channelProof.supportingMetric}` : ""}
            </p>
            <p className="leading-6">{channelProof.detail}</p>
          </div>
        ) : null}

        {competitorProof ? (
          <div>
            <p className="font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Competitor proof
            </p>
            <p className="mt-1 leading-6 text-foreground">
              {competitorProof.title}
              {competitorProof.supportingMetric ? ` · ${competitorProof.supportingMetric}` : ""}
            </p>
            <p className="leading-6">{competitorProof.detail}</p>
          </div>
        ) : null}

        <div>
          <p className="font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Thumbnail direction
          </p>
          <p className="mt-1 leading-6 text-foreground">{opportunity.thumbnailDirection}</p>
        </div>
      </div>
    </AppPanel>
  );
}

function getSuggestedTitles(project: ScriptProjectDetail): string[] {
  if (project.opportunity) {
    const { topic, packageSeed, title } = project.opportunity;
    const cleanTopic = topic.trim();
    const loweredTopic = cleanTopic.toLowerCase();
    return [
      packageSeed.title,
      title,
      `Why ${loweredTopic} is really an operator story`,
      `The hidden business model inside ${cleanTopic}`,
    ].filter((value, index, items) => value && items.indexOf(value) === index).slice(0, 3);
  }

  const cleanTopic = project.topic.trim();
  const loweredTopic = cleanTopic.toLowerCase();
  return [
    project.title,
    `The contrarian play inside ${cleanTopic}`,
    `What most people miss about ${loweredTopic}`,
  ].filter((value, index, items) => value && items.indexOf(value) === index).slice(0, 3);
}

function formatResearchSourceMeta(item: ScriptProjectDetail["researchItems"][number]) {
  const metadata = parseRecord(item.metadata);
  const metric =
    metadataString(metadata, "supportingMetric") ??
    (metadataNumber(metadata, "viewCount") ? `${formatCompactNumber(metadataNumber(metadata, "viewCount") ?? 0)} views` : null);
  const source =
    metadataString(metadata, "videoTitle") ??
    metadataString(metadata, "exemplarTitle") ??
    metadataString(metadata, "source");

  return [metric, source].filter(Boolean).join(" · ");
}

function ResearchEvidencePanel({
  title,
  description,
  items,
  empty,
}: {
  title: string;
  description: string;
  items: ScriptProjectDetail["researchItems"];
  empty: string;
}) {
  return (
    <AppPanel className="grid gap-4 px-5 py-5">
      <div className="space-y-1">
        <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
          {title}
        </h2>
        <p className="text-[14px] leading-6 text-muted-foreground">{description}</p>
      </div>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-[12px] border border-border bg-background px-4 py-4">
              <p className="text-[15px] font-semibold text-foreground">
                {item.title ?? "Untitled source"}
              </p>
              {formatResearchSourceMeta(item) ? (
                <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.06em] text-primary">
                  {formatResearchSourceMeta(item)}
                </p>
              ) : null}
              <p className="mt-2 text-[14px] leading-7 text-muted-foreground">
                {item.excerpt ?? "No excerpt available."}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[14px] leading-7 text-muted-foreground">{empty}</p>
      )}
    </AppPanel>
  );
}

function ResearchStepLayout({
  project,
  activePersonaLabel,
  isPending,
  error,
  onBuildResearch,
  onGenerateHooks,
}: {
  project: ScriptProjectDetail;
  activePersonaLabel: string | null;
  isPending: boolean;
  error: string | null;
  onBuildResearch: () => void;
  onGenerateHooks: () => void;
}) {
  const opportunityBrief = project.researchItems.find((item) => item.itemType === "opportunity_brief") ?? null;
  const channelProof = project.researchItems.filter((item) => item.itemType === "channel_evidence").slice(0, 3);
  const competitorProof = project.researchItems
    .filter((item) => item.itemType === "competitor_evidence")
    .slice(0, 3);
  const quotes = project.researchItems.filter((item) => item.itemType === "quote").slice(0, 4);
  const voiceAnchors = project.researchItems
    .filter((item) => item.itemType === "persona_style")
    .slice(0, 3);
  const suggestedTitles = getSuggestedTitles(project);

  return (
    <div className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Research Brief
            </p>
            <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
              {project.title}
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              {project.opportunity
                ? "This brief should answer one question clearly: why this is the best next video to greenlight."
                : "This brief should stack the best evidence, proof points, and positioning for the topic."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onBuildResearch} disabled={isPending}>
              {isPending ? "Refreshing..." : "Refresh Research"}
            </Button>
            <Button onClick={onGenerateHooks} disabled={isPending}>
              {isPending ? "Generating..." : "Generate Hook Options"}
            </Button>
          </div>
        </div>

        <AppPanel className="grid gap-5 px-6 py-6">
          <div className="grid gap-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Package thesis
            </p>
            <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
              {project.opportunity?.title ?? project.title}
            </h2>
            <p className="text-[16px] leading-8 text-foreground">
              {project.opportunity?.angle ?? project.topic}
            </p>
            <p className="text-[15px] leading-7 text-muted-foreground">
              {project.opportunity?.whyNow ??
                opportunityBrief?.excerpt ??
                "Use the evidence below to decide whether this topic is strong enough to turn into a package."}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[12px] border border-border bg-background px-4 py-4">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Best hook angle
              </p>
              <p className="mt-2 text-[15px] leading-7 text-foreground">
                {project.opportunity?.recommendedHook ??
                  "Lead with the most counterintuitive business lesson in the evidence stack."}
              </p>
            </div>
            <div className="rounded-[12px] border border-border bg-background px-4 py-4">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Recommended format
              </p>
              <p className="mt-2 text-[15px] leading-7 text-foreground">
                {project.opportunity?.recommendedFormat ?? "Evidence-led business explainer"}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {project.opportunity?.recommendedDuration ?? "12-18 min"}
              </p>
            </div>
            <div className="rounded-[12px] border border-border bg-background px-4 py-4">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Thumbnail promise
              </p>
              <p className="mt-2 text-[15px] leading-7 text-foreground">
                {project.opportunity?.thumbnailDirection ??
                  "Use one instantly legible business claim and a single dominant subject."}
              </p>
            </div>
          </div>
        </AppPanel>

        <AppPanel className="grid gap-4 px-6 py-6">
          <div className="space-y-1">
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
              Titles to test
            </h2>
            <p className="text-[14px] leading-6 text-muted-foreground">
              Three production-ready directions to pressure-test before you move into hooks and the first-minute draft.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {suggestedTitles.map((title, index) => (
              <div
                key={title}
                className="rounded-[12px] border border-border bg-background px-4 py-4"
              >
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Option {index + 1}
                </p>
                <p className="mt-2 text-[15px] leading-7 text-foreground">{title}</p>
              </div>
            ))}
          </div>
        </AppPanel>

        <div className="grid gap-5 xl:grid-cols-2">
          <ResearchEvidencePanel
            title="Channel proof"
            description="Why this already fits the channel's audience and format memory."
            items={channelProof}
            empty="No channel-native proof has been attached yet."
          />
          <ResearchEvidencePanel
            title="Competitor proof"
            description="External evidence that the audience already responds to this angle."
            items={competitorProof}
            empty="No competitor proof is attached to this package yet."
          />
        </div>

        <ResearchEvidencePanel
          title="Proof to cite in the opening minute"
          description="These are the strongest transcript or semantic evidence clips to anchor the script in specifics."
          items={quotes}
          empty="Build research again to pull stronger quotes into the package."
        />

        <ResearchEvidencePanel
          title="Voice anchors"
          description="Use these persona or corpus references to keep the delivery in the creator's lane."
          items={voiceAnchors}
          empty="No persona-style anchors are attached yet."
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <aside className="grid gap-5">
        <AppPanel className="grid gap-3 px-5 py-5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
            Package Info
          </h2>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p className="flex items-center justify-between gap-4">
              <span>Channel</span>
              <span className="font-medium text-foreground">{project.channelName ?? "Unassigned"}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span>Status</span>
              <span className="font-medium capitalize text-foreground">{project.status}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span>Research items</span>
              <span className="font-medium text-foreground">{project.researchItems.length}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span>Updated</span>
              <span className="font-medium text-foreground">{formatRelativeDate(project.updatedAt)}</span>
            </p>
          </div>
        </AppPanel>

        <OpportunitySummaryPanel project={project} />

        <AppPanel className="grid gap-3 px-5 py-5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
            Why this package
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{project.opportunity?.rationale ?? "This package is using your selected topic and current channel context."}</p>
            <p>{activePersonaLabel ?? "No trained persona model attached yet."}</p>
          </div>
        </AppPanel>

        <AppPanel className="grid gap-3 px-5 py-5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
            Next Action
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            If this brief feels credible, move to Hook Options next. That is the first irreversible creative decision in the package.
          </p>
          <Button onClick={onGenerateHooks} disabled={isPending}>
            {isPending ? "Generating..." : "Generate Hook Options"}
          </Button>
        </AppPanel>
      </aside>
    </div>
  );
}

function GenericStepLayout({
  slug,
  project,
  activeStep,
  output,
  isPending,
  error,
  activePersonaLabel,
  onBuildResearch,
  onGenerate,
  onCopy,
}: {
  slug: string;
  project: ScriptProjectDetail;
  activeStep: ScriptLabViewStep;
  output: ScriptOutputVersion | ThumbnailBriefVersion | null;
  isPending: boolean;
  error: string | null;
  activePersonaLabel: string | null;
  onBuildResearch: () => void;
  onGenerate: (step: ScriptLabStep) => void;
  onCopy: () => Promise<void>;
}) {
  return (
    <div className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {outputStepLabels[activeStep]}
            </p>
            <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
              {project.title}
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">{project.topic}</p>
          </div>

          <div className="flex items-center gap-2">
            {output && "content" in output ? (
              <Button variant="outline" onClick={() => void onCopy()}>
                Copy
              </Button>
            ) : null}
            {activeStep === "research" ? (
              <Button onClick={onBuildResearch} disabled={isPending}>
                {isPending ? "Refreshing..." : "Refresh Research"}
              </Button>
            ) : activeStep !== "topic_input" ? (
              <Button onClick={() => onGenerate(activeStep as ScriptLabStep)} disabled={isPending}>
                {isPending ? "Generating..." : `Generate ${outputStepLabels[activeStep]}`}
              </Button>
            ) : null}
          </div>
        </div>

        {activeStep === "topic_input" ? (
          <AppPanel className="grid gap-4 px-6 py-6">
            <div className="flex items-center gap-3">
              <ChannelAvatar channelName={project.channelName ?? "Channel"} channelSlug={slug} />
              <div>
                <p className="text-[15px] font-medium text-foreground">
                  {project.channelName ?? "No channel attached"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Updated {formatRelativeDate(project.updatedAt)}
                </p>
              </div>
            </div>
            <p className="text-[15px] leading-7 text-foreground">
              This project is ready for research and generation. Use the workflow on the left to
              move through hooks, scripts, notes, thumbnails, and previs.
            </p>
            {project.opportunity ? (
              <div className="rounded-[12px] border border-border bg-secondary/70 px-4 py-4 text-[14px] leading-7 text-muted-foreground">
                <p className="font-medium text-foreground">Seeded from a ranked opportunity</p>
                <p className="mt-1">
                  {project.opportunity.title} — {project.opportunity.angle}
                </p>
              </div>
            ) : null}
          </AppPanel>
        ) : null}

        {activeStep === "research" ? (
          project.researchItems.length ? (
            <div className="grid gap-3">
              {project.researchItems.map((item) => (
                <AppPanel key={item.id} className="px-5 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {item.itemType.replace(/_/g, " ")}
                      </p>
                      <h2 className="mt-1 text-[16px] font-semibold text-foreground">
                        {item.title ?? "Untitled source"}
                      </h2>
                    </div>
                    {item.score ? (
                      <span className="text-sm font-medium text-primary">Score {item.score.toFixed(2)}</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[15px] leading-7 text-foreground">
                    {item.excerpt ?? "No excerpt available."}
                  </p>
                </AppPanel>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No research yet"
              description="Build research to pull quotes, hooks, and topic gaps into this project."
            />
          )
        ) : null}

        {activeStep !== "topic_input" && activeStep !== "research" ? (
          output ? (
            <StepOutputBody output={output} />
          ) : (
            <EmptyState
              title={`No ${outputStepLabels[activeStep].toLowerCase()} yet`}
              description={`Generate ${outputStepLabels[activeStep].toLowerCase()} for this project to populate the editor.`}
            />
          )
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <aside className="grid gap-5">
        <AppPanel className="grid gap-3 px-5 py-5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
            Script Info
          </h2>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p className="flex items-center justify-between gap-4">
              <span>Channel</span>
              <span className="font-medium text-foreground">{project.channelName ?? "Unassigned"}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span>Status</span>
              <span className="font-medium capitalize text-foreground">{project.status}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span>Research items</span>
              <span className="font-medium text-foreground">{project.researchItems.length}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span>Updated</span>
              <span className="font-medium text-foreground">{formatRelativeDate(project.updatedAt)}</span>
            </p>
          </div>
        </AppPanel>

        <OpportunitySummaryPanel project={project} />

        <AppPanel className="grid gap-3 px-5 py-5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
            Sources Used
          </h2>
          <div className="grid gap-3 text-sm">
            {project.researchItems.slice(0, 3).map((item) => (
              <div key={item.id}>
                <p className="font-medium text-foreground">{item.title ?? "Untitled source"}</p>
                <p className="text-muted-foreground">{item.itemType.replace(/_/g, " ")}</p>
              </div>
            ))}
            {!project.researchItems.length ? (
              <p className="text-muted-foreground">Research sources will appear here.</p>
            ) : null}
          </div>
        </AppPanel>

        <AppPanel className="grid gap-3 px-5 py-5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-foreground">
            Style Match
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{activePersonaLabel ?? "No trained persona model attached yet."}</p>
            <p>
              Workspace context: {formatCompactNumber(project.researchItems.length)} research items
              available for guidance.
            </p>
          </div>
        </AppPanel>
      </aside>
    </div>
  );
}

function ThumbnailReviewLayout({
  slug,
  projectId,
  thumbnailBrief,
  thumbnailJob,
  thumbnailAssets,
  selectedAssetId,
  isPending,
  error,
  onGenerate,
}: {
  slug: string;
  projectId: string;
  thumbnailBrief: ThumbnailBriefVersion | null;
  thumbnailJob: GenerationJobSummary | null;
  thumbnailAssets: GenerationAssetSummary[];
  selectedAssetId: string | null;
  isPending: boolean;
  error: string | null;
  onGenerate: (step: ScriptLabStep) => void;
}) {
  const selectedAsset =
    thumbnailAssets.find((asset) => asset.id === selectedAssetId) ?? null;
  const otherAssets = thumbnailAssets.filter((asset) => asset.id !== selectedAsset?.id);

  if (selectedAsset) {
    const selectedIndex = thumbnailAssets.findIndex((asset) => asset.id === selectedAsset.id);

    return (
      <div className="grid gap-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
              Thumbnail Selected
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              {getThumbnailTitle(selectedAsset, selectedIndex)} — {getThumbnailSummary(selectedAsset, selectedIndex)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href={buildProjectStepHref(slug, projectId, "thumbnail_brief")}>Back to Grid</Link>
            </Button>
            <Button asChild>
              <Link
                href={buildProjectStepHref(slug, projectId, "previs", {
                  thumbnailAssetId: selectedAsset.id,
                })}
              >
                Continue to Previs
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,523px)_261px]">
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[18px] border border-border bg-card">
              <Image
                src={buildBackendUrl(selectedAsset.downloadPath)}
                alt={getThumbnailTitle(selectedAsset, selectedIndex)}
                width={1280}
                height={720}
                unoptimized
                className="aspect-video w-full object-cover"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[20px] font-semibold tracking-[-0.03em] text-foreground">
                  {getThumbnailTitle(selectedAsset, selectedIndex)}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {formatRelativeDate(selectedAsset.createdAt)}
                </p>
              </div>
              <p className="max-w-[520px] text-[15px] leading-7 text-muted-foreground">
                {getThumbnailSummary(selectedAsset, selectedIndex)}
              </p>
              {thumbnailBrief ? (
                <p className="text-[14px] leading-7 text-muted-foreground">
                  Brief version {thumbnailBrief.version}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Other Variants
            </p>
            {otherAssets.map((asset) => {
              const actualIndex = thumbnailAssets.findIndex((item) => item.id === asset.id);
              return (
                <Link
                  key={asset.id}
                  href={buildProjectStepHref(slug, projectId, "thumbnail_brief", { variant: asset.id })}
                  className="grid gap-3 rounded-[14px] border border-border bg-card p-3 transition-colors hover:bg-secondary"
                >
                  <Image
                    src={buildBackendUrl(asset.downloadPath)}
                    alt={getThumbnailTitle(asset, actualIndex)}
                    width={1280}
                    height={720}
                    unoptimized
                    className="aspect-video w-full rounded-[10px] object-cover"
                  />
                  <div className="grid gap-1">
                    <p className="text-[15px] font-medium text-foreground">
                      {getThumbnailTitle(asset, actualIndex)}
                    </p>
                    <p className="line-clamp-2 text-[13px] text-muted-foreground">
                      {getThumbnailSummary(asset, actualIndex)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
            Thumbnail Review
          </h1>
          <p className="text-[15px] leading-7 text-muted-foreground">
            {thumbnailAssets.length
              ? `${thumbnailAssets.length} variants generated — select your favorite`
              : thumbnailJob?.message ?? "Generate thumbnail variants for this script."}
          </p>
        </div>
        <Button variant="outline" onClick={() => onGenerate("thumbnail_brief")} disabled={isPending}>
          {isPending ? "Regenerating..." : "Regenerate All"}
        </Button>
      </div>

      {thumbnailAssets.length ? (
        <div className="grid gap-6 md:grid-cols-2">
          {thumbnailAssets.map((asset, index) => (
            <Link
              key={asset.id}
              href={buildProjectStepHref(slug, projectId, "thumbnail_brief", { variant: asset.id })}
              className="grid gap-3"
            >
              <div className="overflow-hidden rounded-[16px] border border-border bg-card">
                <Image
                  src={buildBackendUrl(asset.downloadPath)}
                  alt={getThumbnailTitle(asset, index)}
                  width={1280}
                  height={720}
                  unoptimized
                  className="aspect-video w-full object-cover"
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[20px] font-semibold tracking-[-0.03em] text-foreground">
                    {getThumbnailTitle(asset, index)}
                  </p>
                  <p className="text-[15px] text-muted-foreground">
                    {getThumbnailSummary(asset, index)}
                  </p>
                </div>
                <span className="mt-1 inline-flex size-6 rounded-full border border-border bg-background" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <AppPanel className="grid min-h-[520px] place-items-center px-6 py-10">
          <div className="grid max-w-[420px] justify-items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-secondary text-primary">
              <LoaderCircle className={cn("size-7", thumbnailJob ? "animate-spin" : "")} />
            </div>
            <div className="space-y-2">
              <p className="text-[24px] font-semibold tracking-[-0.03em] text-foreground">
                {thumbnailJob?.status === "failed"
                  ? "Thumbnail generation failed"
                  : thumbnailJob
                    ? "Generating thumbnail variants"
                    : "No thumbnail variants yet"}
              </p>
              <p className="text-[15px] leading-7 text-muted-foreground">
                {thumbnailJob?.errorMessage ??
                  thumbnailJob?.message ??
                  "Trigger thumbnail generation to create reviewable variants for this script."}
              </p>
            </div>
            {thumbnailBrief ? (
              <div className="rounded-[12px] border border-border bg-background px-4 py-4 text-left text-[14px] leading-7 text-muted-foreground">
                {thumbnailBrief.content}
              </div>
            ) : null}
          </div>
        </AppPanel>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function PrevisLayout({
  project,
  previsJob,
  previsFrames,
  previsVideo,
  isPending,
  error,
  onGenerate,
}: {
  project: ScriptProjectDetail;
  previsJob: GenerationJobSummary | null;
  previsFrames: GenerationAssetSummary[];
  previsVideo: GenerationAssetSummary | null;
  isPending: boolean;
  error: string | null;
  onGenerate: (step: ScriptLabStep) => void;
}) {
  const videoMetadata = parseRecord(previsVideo?.metadata);
  const sceneCount = metadataNumber(videoMetadata, "sceneCount") ?? previsFrames.length;
  const totalDurationSeconds = metadataNumber(videoMetadata, "durationSeconds");
  const progressPercent = Math.round((previsJob?.progress ?? 0) * 100);
  const status = previsJob?.status ?? "idle";
  const subtitle =
    status === "completed"
      ? "Scene-by-scene storyboard with timing and shot guidance"
      : status === "failed"
        ? "Rendering failed — an error occurred during generation"
        : status === "running" || status === "training"
          ? "Rendering scene-by-scene storyboard..."
          : "Queue a rough-cut previs render for this script.";

  const styleMatch = project.outputs.some((output) => output.step === "director_notes") ? 94 : 88;
  const bRollCueCount = Math.max(0, project.outputs.some((output) => output.step === "director_notes") ? sceneCount + 3 : sceneCount);
  const onScreenTextCount = Math.max(0, Math.min(sceneCount, 4));

  if (status === "completed" && (previsFrames.length || previsVideo)) {
    return (
      <div className="grid gap-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
              Previsualization
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onGenerate("previs")} disabled={isPending}>
              {isPending ? "Regenerating..." : "Regenerate"}
            </Button>
            {previsVideo ? (
              <Button asChild>
                <a href={buildBackendUrl(previsVideo.downloadPath)} download>
                  Finish & Export
                </a>
              </Button>
            ) : (
              <Button disabled>Finish & Export</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(sceneCount, 5) }).map((_, index) => (
            <div key={index} className="h-1 rounded-full bg-secondary">
              <div
                className={cn(
                  "h-1 rounded-full",
                  index === 0 ? "bg-primary" : index < sceneCount ? "bg-foreground" : "bg-secondary"
                )}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {previsFrames.map((asset, index) => {
            const metadata = parseRecord(asset.metadata);
            const title = metadataString(metadata, "title") ?? sceneStepNames[index] ?? `Scene ${index + 1}`;
            const caption = metadataString(metadata, "caption") ?? "Scene guidance will appear here.";

            return (
              <AppPanel key={asset.id} className="overflow-hidden p-0">
                <Image
                  src={buildBackendUrl(asset.downloadPath)}
                  alt={title}
                  width={1280}
                  height={720}
                  unoptimized
                  className="aspect-video w-full object-cover"
                />
                <div className="grid gap-2 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className={cn("text-[20px] font-semibold tracking-[-0.03em]", index === 0 ? "text-primary" : "text-foreground")}>
                      {title}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {getPrevisDurationLabel(index, Math.max(sceneCount, 1), totalDurationSeconds)}
                    </p>
                  </div>
                  <p className="text-[15px] leading-7 text-muted-foreground">{caption}</p>
                </div>
              </AppPanel>
            );
          })}
        </div>

        <AppPanel className="grid gap-4 px-6 py-5 md:grid-cols-5">
          <MetricBlock label="Total Duration" value={totalDurationSeconds ? `${Math.round(totalDurationSeconds / 60)}:${String(totalDurationSeconds % 60).padStart(2, "0")}` : "—"} />
          <MetricBlock label="Scenes" value={String(sceneCount)} />
          <MetricBlock label="B-roll Cues" value={String(bRollCueCount)} />
          <MetricBlock label="On-screen Text" value={String(onScreenTextCount)} />
          <MetricBlock label="Style Match" value={`${styleMatch}%`} accent="text-primary" />
        </AppPanel>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="grid gap-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
              Previsualization
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(previsJob?.errorMessage ?? previsJob?.message ?? "")}>
              Copy Error
            </Button>
            <Button onClick={() => onGenerate("previs")} disabled={isPending}>
              {isPending ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </div>

        <AppPanel className="grid min-h-[540px] place-items-center px-6 py-10">
          <div className="grid max-w-[440px] justify-items-center gap-5 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-7" />
            </div>
            <div className="space-y-2">
              <p className="text-[24px] font-semibold tracking-[-0.03em] text-foreground">
                Rendering Failed
              </p>
              <p className="text-[15px] leading-7 text-muted-foreground">
                {previsJob?.message ??
                  "An error occurred while generating the previs render. Retry the job after checking the generation output."}
              </p>
            </div>
            <div className="w-full rounded-[12px] border border-border bg-secondary px-4 py-4 text-left text-[14px] leading-7 text-muted-foreground">
              {previsJob?.errorMessage ?? previsJob?.message ?? "Unknown previs render failure."}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] text-muted-foreground">
                {previsJob?.stage ?? "failed"}
              </span>
              <span className="rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] text-muted-foreground">
                {progressPercent}%
              </span>
              <span className="rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] text-muted-foreground">
                {sceneCount || 0} scenes
              </span>
            </div>
          </div>
        </AppPanel>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  const isRunning = status === "running" || status === "training" || status === "queued" || status === "provisioning";
  const completedSceneCount = Math.max(previsFrames.length, Math.floor((progressPercent / 100) * Math.max(sceneCount, 5)));

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-[40px] font-semibold tracking-[-0.05em] text-foreground">
            Previsualization
          </h1>
          <p className="text-[15px] leading-7 text-muted-foreground">{subtitle}</p>
        </div>
        {isRunning ? (
          <Button variant="outline" disabled>
            Rendering
          </Button>
        ) : (
          <Button onClick={() => onGenerate("previs")} disabled={isPending}>
            {isPending ? "Starting..." : "Generate Previsualization"}
          </Button>
        )}
      </div>

      <AppPanel className="grid min-h-[540px] place-items-center px-6 py-10">
        <div className="grid max-w-[420px] justify-items-center gap-5 text-center">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-secondary text-primary">
            <LoaderCircle className={cn("size-7", isRunning ? "animate-spin" : "")} />
          </div>
          <div className="space-y-2">
            <p className="text-[24px] font-semibold tracking-[-0.03em] text-foreground">
              {isRunning
                ? `Rendering Scene ${Math.max(completedSceneCount, 1)} of ${Math.max(sceneCount, 5)}`
                : "Previsualization queued"}
            </p>
            <p className="text-[15px] leading-7 text-muted-foreground">
              {previsJob?.message ??
                "Generating shot compositions, B-roll cues, and timing overlays for the rough cut."}
            </p>
          </div>
          <div className="grid gap-2">
            <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">
              {progressPercent}%
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-1 rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[13px] text-muted-foreground">
            <StatusChip label="Frames" value={String(previsFrames.length)} />
            <StatusChip label="Stage" value={previsJob?.stage ?? "queued"} />
            <StatusChip label="Scenes" value={String(Math.max(sceneCount, 5))} />
            <StatusChip label="Status" value={status} />
            <StatusChip
              label="Voice"
              value={metadataBoolean(videoMetadata, "hasVoiceover") ? "On" : "Optional"}
            />
          </div>
        </div>
      </AppPanel>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function MetricBlock({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="grid gap-2 border-b border-separator pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-4 last:border-r-0">
      <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={cn("font-display text-[24px] font-semibold tracking-[-0.04em]", accent)}>{value}</p>
    </div>
  );
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-medium text-foreground">{label}</span>
      <span>{value}</span>
    </span>
  );
}

export default function ScriptLabProjectPage() {
  const params = useParams<{ slug: string; projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug;
  const projectId = params.projectId;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const projectResponse = useBackendQuery<ScriptProjectResponse>(
    `/script-lab/projects/${encodeURIComponent(projectId)}`,
    { pollMs: 5000 }
  );
  const personaModels = useBackendQuery<PersonaModelListResponse>("/persona-models");

  if (projectResponse.error) {
    return (
      <main className="pb-10">
        <Breadcrumb slug={slug} projectId={projectId} step="research" />
        <div className="flex min-h-[calc(100vh-145px)]">
          <ScriptLabWorkflowSidebar activeStep="research" channelSlug={slug} projectId={projectId} />
          <section className="flex-1 px-6 py-12 md:px-10 xl:px-12">
            <ErrorState
              title="Script project unavailable"
              description="The app could not load this Script Lab project. Retry the request or return to the project list."
              action={
                <div className="flex items-center gap-3">
                  <Button onClick={() => projectResponse.refetch()}>Retry</Button>
                  <Button asChild variant="outline">
                    <Link href={`/app/channels/${slug}/script-lab/projects`}>Back to Projects</Link>
                  </Button>
                </div>
              }
            />
          </section>
        </div>
      </main>
    );
  }

  if (!projectResponse.data?.project) {
    return <ScriptLabProjectLoadingState slug={slug} projectId={projectId} />;
  }

  const project = projectResponse.data.project;
  const requestedStep = searchParams.get("step");
  const activeStep = isViewStep(requestedStep) ? requestedStep : getDefaultStep(project);
  const selectedThumbnailId = searchParams.get("variant");
  const activePersona = personaModels.data?.items.find(
    (item) =>
      item.id === project.personaModelId &&
      item.channelSlug === slug &&
      item.status === "ready"
  );
  const completedSteps = getCompletedSteps(project);

  const genericOutput =
    activeStep === "hooks" || activeStep === "script" || activeStep === "director_notes"
      ? (findLatestOutput(project, activeStep) as ScriptOutputVersion | null)
      : null;

  const thumbnailBrief = findLatestOutput(project, "thumbnail_brief") as ThumbnailBriefVersion | null;
  const thumbnailJob = findLatestGenerationJob(project, "thumbnail_images");
  const thumbnailAssets = findJobAssets(project, thumbnailJob, "thumbnail_image");
  const previsJob = findLatestGenerationJob(project, "previs");
  const previsFrames = findJobAssets(project, previsJob, "previs_frame");
  const previsVideo = findJobAssets(project, previsJob, "previs_video")[0] ?? null;

  async function handleBuildResearch() {
    setError(null);
    startTransition(async () => {
      try {
        await fetchBackend(`/script-lab/projects/${projectId}/research`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        projectResponse.refetch();
        router.replace(buildProjectStepHref(slug, projectId, "research"));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to build research.");
      }
    });
  }

  async function handleGenerate(step: ScriptLabStep) {
    setError(null);
    startTransition(async () => {
      try {
        await fetchBackend(`/script-lab/projects/${projectId}/generate`, {
          method: "POST",
          body: JSON.stringify({ step }),
        });
        projectResponse.refetch();
        router.replace(buildProjectStepHref(slug, projectId, step as ScriptLabViewStep));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to generate that step.");
      }
    });
  }

  async function handleCopy() {
    if (!genericOutput?.content || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(genericOutput.content);
  }

  const activePersonaLabel = activePersona
    ? `Using persona model: ${activePersona.baseModel}`
    : null;

  return (
    <main className="pb-10">
      <Breadcrumb slug={slug} projectId={projectId} step={activeStep} />

      <div className="flex min-h-[calc(100vh-145px)]">
        <ScriptLabWorkflowSidebar
          activeStep={activeStep}
          channelSlug={slug}
          projectId={projectId}
          completedSteps={completedSteps}
        />

        <section className="flex-1 px-6 py-9 md:px-10 xl:px-12">
          {activeStep === "research" ? (
            <ResearchStepLayout
              project={project}
              activePersonaLabel={activePersonaLabel}
              isPending={isPending}
              error={error}
              onBuildResearch={handleBuildResearch}
              onGenerateHooks={() => handleGenerate("hooks")}
            />
          ) : activeStep === "thumbnail_brief" ? (
            <ThumbnailReviewLayout
              slug={slug}
              projectId={projectId}
              thumbnailBrief={thumbnailBrief}
              thumbnailJob={thumbnailJob}
              thumbnailAssets={thumbnailAssets}
              selectedAssetId={selectedThumbnailId}
              isPending={isPending}
              error={error}
              onGenerate={handleGenerate}
            />
          ) : activeStep === "previs" ? (
            <PrevisLayout
              project={project}
              previsJob={previsJob}
              previsFrames={previsFrames}
              previsVideo={previsVideo}
              isPending={isPending}
              error={error}
              onGenerate={handleGenerate}
            />
          ) : (
            <GenericStepLayout
              slug={slug}
              project={project}
              activeStep={activeStep}
              output={genericOutput}
              isPending={isPending}
              error={error}
              activePersonaLabel={activePersonaLabel}
              onBuildResearch={handleBuildResearch}
              onGenerate={handleGenerate}
              onCopy={handleCopy}
            />
          )}
        </section>
      </div>
    </main>
  );
}
