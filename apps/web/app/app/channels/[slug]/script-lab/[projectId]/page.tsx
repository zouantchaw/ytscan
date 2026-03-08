"use client";

import Image from "next/image";
import { useSearchParams, useParams, useRouter } from "next/navigation";
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
import { AppPanel, ChannelAvatar, EmptyState } from "@/components/app/app-ui";
import {
  ScriptLabWorkflowSidebar,
  type ScriptLabViewStep,
} from "@/components/app/script-lab-workflow";
import { Button } from "@/components/ui/button";
import { buildBackendUrl, fetchBackend, useBackendQuery } from "@/lib/backend-client";
import {
  formatCompactNumber,
  formatRelativeDate,
} from "@/lib/formatters";

const outputStepLabels: Record<ScriptLabViewStep, string> = {
  topic_input: "Topic Input",
  research: "Research",
  hooks: "Hook Options",
  script: "Generated Script",
  director_notes: "Director's Notes",
  thumbnail_brief: "Thumbnail Brief",
  previs: "Previsualization",
};

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

function findLatestOutput(
  project: ScriptProjectDetail,
  step: ScriptLabStep
): ScriptOutputVersion | ThumbnailBriefVersion | GenerationJobSummary | null {
  if (step === "thumbnail_brief") {
    return project.thumbnailBriefs[0] ?? null;
  }

  if (step === "previs") {
    return project.generationJobs.find((job) => job.jobType === "previs") ?? null;
  }

  return project.outputs.find((output) => output.step === step) ?? null;
}

function findLatestGenerationJob(
  project: ScriptProjectDetail,
  jobType: string
): GenerationJobSummary | null {
  return project.generationJobs.find((job) => job.jobType === jobType) ?? null;
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

  if (scopedAssets.length) return scopedAssets;
  return project.generatedAssets.filter((asset) => asset.assetKind === assetKind);
}

function getDefaultStep(project: ScriptProjectDetail): ScriptLabViewStep {
  if (project.outputs.some((output) => output.step === "script")) return "script";
  if (project.outputs.some((output) => output.step === "hooks")) return "hooks";
  if (project.researchItems.length > 0) return "research";
  return "topic_input";
}

function OutputBody({
  project,
  step,
  output,
}: {
  project: ScriptProjectDetail;
  step: ScriptLabViewStep;
  output: ScriptOutputVersion | ThumbnailBriefVersion | GenerationJobSummary | null;
}) {
  if (step === "research") {
    return null;
  }

  if (step === "thumbnail_brief") {
    const thumbnailJob = findLatestGenerationJob(project, "thumbnail_images");
    const thumbnailAssets = findJobAssets(project, thumbnailJob, "thumbnail_image");

    return (
      <div className="grid gap-6">
        {output && "content" in output ? (
          <div className="rounded-[12px] border border-border bg-card px-6 py-6">
            <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">
              {output.content}
            </div>
          </div>
        ) : null}

        <div className="space-y-4 rounded-[12px] border border-border bg-card px-6 py-6">
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>
              Status:{" "}
              <span className="font-medium text-foreground">
                {thumbnailJob?.status ?? "idle"}
              </span>
            </p>
            <p>
              Stage:{" "}
              <span className="font-medium text-foreground">
                {thumbnailJob?.stage ?? "waiting"}
              </span>
            </p>
            <p>
              Progress:{" "}
              <span className="font-medium text-foreground">
                {Math.round((thumbnailJob?.progress ?? 0) * 100)}%
              </span>
            </p>
            {thumbnailJob?.message ? (
              <p>
                Message:{" "}
                <span className="font-medium text-foreground">{thumbnailJob.message}</span>
              </p>
            ) : null}
          </div>

          {thumbnailAssets.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {thumbnailAssets.map((asset) => (
                  <div key={asset.id} className="grid gap-3">
                    <Image
                      src={buildBackendUrl(asset.downloadPath)}
                      alt={asset.variant ?? asset.fileName}
                      width={1280}
                      height={720}
                      unoptimized
                      className="aspect-video w-full rounded-[10px] border border-border object-cover"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {asset.variant?.replace(/-/g, " ") ?? asset.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(asset.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generated thumbnail variants will appear here once the media worker finishes.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === "previs" && output && "jobType" in output) {
    const previsFrames = findJobAssets(project, output, "previs_frame");
    const previsVideo = findJobAssets(project, output, "previs_video")[0] ?? null;

    return (
      <div className="space-y-6 rounded-[12px] border border-border bg-card px-6 py-6">
        <div className="space-y-4">
          <p className="text-[15px] leading-7 text-foreground">
            Previsualization is {output.status}. This panel shows the live state of the rough-cut render pipeline.
          </p>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>
              Status: <span className="font-medium text-foreground">{output.status}</span>
            </p>
            <p>
              Stage: <span className="font-medium text-foreground">{output.stage}</span>
            </p>
            <p>
              Progress:{" "}
              <span className="font-medium text-foreground">{Math.round(output.progress * 100)}%</span>
            </p>
            {output.message ? (
              <p>
                Message: <span className="font-medium text-foreground">{output.message}</span>
              </p>
            ) : null}
            {output.providerJobId ? (
              <p>
                Provider job: <span className="font-medium text-foreground">{output.providerJobId}</span>
              </p>
            ) : null}
          </div>
        </div>

        {previsVideo ? (
          <div className="grid gap-4">
            <video
              controls
              className="aspect-video w-full rounded-[10px] border border-border bg-black"
              src={buildBackendUrl(previsVideo.downloadPath)}
            />
            <p className="text-sm text-muted-foreground">
              Rough cut generated {formatRelativeDate(previsVideo.createdAt)}.
            </p>
          </div>
        ) : null}

        {previsFrames.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {previsFrames.map((asset) => (
              <div key={asset.id} className="grid gap-3">
                <Image
                  src={buildBackendUrl(asset.downloadPath)}
                  alt={asset.variant ?? asset.fileName}
                  width={1280}
                  height={720}
                  unoptimized
                  className="aspect-video w-full rounded-[10px] border border-border object-cover"
                />
                <p className="text-sm text-muted-foreground">
                  {asset.variant?.replace(/-/g, " ") ?? asset.fileName}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {!previsVideo && !previsFrames.length ? (
          <p className="text-sm text-muted-foreground">
            Storyboard frames and the rough MP4 will appear here once rendering begins.
          </p>
        ) : null}
      </div>
    );
  }

  if (!output || !("content" in output)) {
    return null;
  }

  return (
    <div className="rounded-[12px] border border-border bg-card px-6 py-6">
      <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">
        {output.content}
      </div>
    </div>
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

  if (!projectResponse.data?.project) {
    return (
      <main className="flex min-h-[calc(100vh-69px)]">
        <ScriptLabWorkflowSidebar activeStep="research" channelSlug={slug} projectId={projectId} />
        <section className="flex-1 px-6 py-12 md:px-10 xl:px-12">
          <AppPanel className="h-[320px]" />
        </section>
      </main>
    );
  }

  const project = projectResponse.data.project;
  const requestedStep = searchParams.get("step");
  const activeStep = isViewStep(requestedStep) ? requestedStep : getDefaultStep(project);
  const output =
    activeStep === "hooks" ||
    activeStep === "script" ||
    activeStep === "director_notes" ||
    activeStep === "thumbnail_brief" ||
    activeStep === "previs"
      ? findLatestOutput(project, activeStep)
      : null;
  const activePersona = personaModels.data?.items.find(
    (item) => item.channelSlug === slug && item.status !== "failed"
  );

  async function handleBuildResearch() {
    setError(null);
    startTransition(async () => {
      try {
        await fetchBackend(`/script-lab/projects/${projectId}/research`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        projectResponse.refetch();
        router.replace(`/app/channels/${slug}/script-lab/${projectId}?step=research`);
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
        router.replace(`/app/channels/${slug}/script-lab/${projectId}?step=${step}`);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to generate that step.");
      }
    });
  }

  async function handleCopy() {
    if (!output || !("content" in output) || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(output.content);
  }

  return (
    <main className="flex min-h-[calc(100vh-69px)]">
      <ScriptLabWorkflowSidebar
        activeStep={activeStep}
        channelSlug={slug}
        projectId={projectId}
      />

      <section className="flex-1 px-6 py-9 md:px-10 xl:px-12">
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
                  <Button variant="outline" onClick={handleCopy}>
                    Copy
                  </Button>
                ) : null}
                {activeStep === "research" ? (
                  <Button onClick={handleBuildResearch} disabled={isPending}>
                    {isPending ? "Refreshing..." : "Refresh Research"}
                  </Button>
                ) : activeStep !== "topic_input" ? (
                  <Button
                    onClick={() => handleGenerate(activeStep as ScriptLabStep)}
                    disabled={isPending}
                  >
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
                  This project is ready for research and generation. Use the workflow on the left to move through hooks, scripts, notes, and previs.
                </p>
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
                          <span className="text-sm font-medium text-primary">
                            Score {item.score.toFixed(2)}
                          </span>
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
                <OutputBody project={project} step={activeStep} output={output} />
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
                  <span className="font-medium text-foreground">{project.status}</span>
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
                <p>
                  {activePersona
                    ? `Persona model ready: ${activePersona.baseModel}`
                    : "No trained persona model attached yet."}
                </p>
                <p>
                  Workspace context: {formatCompactNumber(project.researchItems.length)} research items available for guidance.
                </p>
              </div>
            </AppPanel>

            {activeStep !== "topic_input" && activeStep !== "research" ? (
              <Button
                variant="outline"
                onClick={() => handleGenerate(activeStep as ScriptLabStep)}
                disabled={isPending}
              >
                {isPending ? "Generating..." : `Regenerate ${outputStepLabels[activeStep]}`}
              </Button>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
