"use client";

import Link from "next/link";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { ChannelDashboard, PersonaModelResponse } from "@ytscan/core";
import { AppPanel, EmptyState } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";
import { formatRelativeDate } from "@/lib/formatters";
import {
  formatMinutes,
  formatUsd,
  getLatestPersonaJob,
  getPersonaEstimatedCost,
  getPersonaJobs,
  getPersonaLaunchPlan,
  getPersonaLoss,
  getPersonaProgress,
  getPersonaSampleText,
  getPersonaStyleMatch,
  getPersonaTrainingMinutes,
} from "@/lib/persona-ui";

function buildStyleTags(channel: ChannelDashboard | null, sampleText: string | null) {
  const tags = new Set<string>();

  channel?.topHooks.slice(0, 3).forEach((hook) => {
    if (hook.hookType === "question") tags.add("Question hook");
    if (hook.hookType === "story") tags.add("Story-led");
    if (hook.hookType === "shock") tags.add("Contrarian hooks");
    if (hook.hookType === "stat") tags.add("Number callouts");
  });

  channel?.topicClusters.slice(0, 2).forEach((cluster) => {
    if (cluster.topic) tags.add(cluster.topic);
  });

  if (sampleText?.toLowerCase().includes("you")) tags.add("Direct address");

  return [...tags].slice(0, 4);
}

function StatusPill({ status }: { status: string }) {
  if (status === "ready") {
    return <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-success">Ready</span>;
  }
  if (status === "failed") {
    return (
      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-destructive">
        Failed
      </span>
    );
  }
  return (
    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#E3A234]">
      Training
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <AppPanel className="space-y-2 px-5 py-5">
      <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={`font-display text-[24px] font-semibold tracking-[-0.04em] ${tone}`}>{value}</p>
    </AppPanel>
  );
}

export default function PersonaModelDetailPage() {
  const params = useParams<{ modelId: string }>();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const modelResponse = useBackendQuery<PersonaModelResponse>(
    `/persona-models/${encodeURIComponent(params.modelId)}`,
    { pollMs: 5000 }
  );
  const model = modelResponse.data?.personaModel ?? null;
  const channel = useBackendQuery<ChannelDashboard>(
    model?.channelSlug ? `/channels/${encodeURIComponent(model.channelSlug)}` : null,
    { enabled: Boolean(model?.channelSlug), pollMs: model?.status === "ready" ? null : 5000 }
  );

  if (!model) {
    return (
      <main className="app-page pb-10 pt-4 lg:pt-0">
        <AppPanel className="h-[420px] max-w-[1104px]" />
      </main>
    );
  }

  const latestJob = getLatestPersonaJob(model);
  const progress = getPersonaProgress(latestJob);
  const launchPlan = getPersonaLaunchPlan(latestJob, model);
  const cost = getPersonaEstimatedCost(latestJob, model);
  const trainingMinutes = getPersonaTrainingMinutes(latestJob);
  const finalLoss = getPersonaLoss(latestJob);
  const styleMatch = getPersonaStyleMatch(latestJob);
  const transcriptCount = channel.data?.totalVideos ?? model.datasetExamples;
  const versionCount = Math.max(
    1,
    getPersonaJobs(model).filter((job) => job.status === "completed").length
  );
  const sampleText = getPersonaSampleText(channel.data?.topHooks[0]?.text ?? null);
  const styleTags = buildStyleTags(channel.data ?? null, sampleText);
  const stage = latestJob?.stage ?? model.status;
  const isReady = model.status === "ready";
  const isFailed = model.status === "failed";

  function handleRetrain() {
    const currentModel = model;
    if (!currentModel) return;
    setError(null);
    startTransition(async () => {
      try {
        await fetchBackend(`/persona-models/${currentModel.id}/train`, {
          method: "POST",
          body: JSON.stringify({ launchInstance: true }),
        });
        modelResponse.refetch();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to start retraining.");
      }
    });
  }

  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-8">
        <section className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
                {model.channelName} Voice Model
              </h1>
              <StatusPill status={model.status} />
            </div>
            <p className="text-[15px] leading-7 text-muted-foreground">
              {isReady
                ? `Trained ${formatRelativeDate(model.updatedAt)} · ${transcriptCount} transcripts · v${versionCount}`
                : `LoRA fine-tuned on ${transcriptCount} transcripts · ${latestJob?.startedAt ? `${formatRelativeDate(latestJob.startedAt)} start` : "in progress"}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleRetrain} disabled={isPending || model.status === "training"}>
              {isPending ? "Starting..." : "Retrain"}
            </Button>
            <Button asChild={isReady}>
              {isReady ? (
                <Link href={`/app/channels/${model.channelSlug}/script-lab?personaModelId=${model.id}`}>
                  Use in Script Lab
                </Link>
              ) : (
                <span>Training in Progress</span>
              )}
            </Button>
          </div>
        </section>

        {isReady ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Final loss" value={finalLoss !== null ? finalLoss.toFixed(3) : "—"} tone="text-success" />
              <MetricCard label="Training time" value={formatMinutes(trainingMinutes)} />
              <MetricCard label="Total cost" value={formatUsd(cost)} />
              <MetricCard label="Style match" value={styleMatch !== null ? `${styleMatch}%` : "—"} tone="text-success" />
            </section>

            <section className="space-y-4">
              <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-foreground">
                Sample Generation
              </h2>
              <AppPanel className="space-y-5 px-6 py-6">
                <p className="max-w-[940px] text-[17px] leading-9 text-foreground">
                  {sampleText ??
                    "This persona model is ready. Use it in Script Lab to generate hooks, drafts, and scene notes in the creator's voice."}
                </p>
              </AppPanel>
              {styleTags.length ? (
                <div className="flex flex-wrap gap-2">
                  {styleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[8px] bg-secondary px-3 py-1.5 text-[13px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <Link
                href={`/app/settings/persona-models/${model.id}/history`}
                className="inline-flex text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View job history
              </Link>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-3">
              <p className="text-[16px] font-medium text-foreground">Training Progress</p>
              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <span>{latestJob?.message ?? "Provisioning Lambda compute"}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full ${isFailed ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span>Stage: {stage}</span>
                {finalLoss !== null ? <span>Loss: {finalLoss.toFixed(3)}</span> : null}
                {trainingMinutes !== null ? <span>{formatMinutes(trainingMinutes)} elapsed</span> : null}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={isFailed ? "Last cost" : "Cost so far"} value={formatUsd(cost)} />
              <MetricCard
                label={isFailed ? "Training time" : "Est. total"}
                value={isFailed ? formatMinutes(trainingMinutes) : formatUsd(cost !== null ? cost / Math.max(progress / 100, 0.2) : null)}
              />
              <MetricCard
                label="GPU"
                value={String(launchPlan.instanceTypeDescription ?? launchPlan.instanceTypeName ?? "Lambda")}
              />
              <MetricCard label="Transcripts" value={String(transcriptCount)} />
            </section>

            {isFailed ? (
              <AppPanel className="space-y-4 px-6 py-6">
                <div className="flex items-center gap-3 text-destructive">
                  <CircleAlert className="size-5" />
                  <p className="text-[18px] font-semibold">Training failed</p>
                </div>
                <div className="rounded-[10px] bg-secondary px-4 py-4 text-[14px] leading-7 text-muted-foreground">
                  {latestJob?.errorMessage ?? latestJob?.message ?? "The training run failed before the adapter was exported."}
                </div>
                <div className="flex items-center gap-3">
                  <Button asChild variant="outline">
                    <Link href={`/app/settings/persona-models/${model.id}/history`}>View Job History</Link>
                  </Button>
                </div>
              </AppPanel>
            ) : (
              <AppPanel className="space-y-5 px-6 py-6">
                <p className="text-[16px] font-medium text-foreground">Steps</p>
                <div className="grid gap-3 text-[15px]">
                  <StepRow
                    label="GPU provisioned"
                    state={progress >= 12 ? "done" : "active"}
                    detail={latestJob?.startedAt ? formatRelativeDate(latestJob.startedAt) : null}
                  />
                  <StepRow
                    label="Base model loaded"
                    state={progress >= 32 ? "done" : progress >= 18 ? "active" : "pending"}
                    detail={String(launchPlan.instanceTypeName ?? model.baseModel.split("/").at(-1) ?? "model")}
                  />
                  <StepRow
                    label="Training LoRA adapter"
                    state={progress >= 86 ? "done" : progress >= 32 ? "active" : "pending"}
                    detail={latestJob?.message ?? null}
                  />
                  <StepRow
                    label="Validation & export"
                    state={progress >= 86 ? "active" : "pending"}
                    detail={progress >= 86 ? "Packaging adapter artifacts" : null}
                  />
                </div>
              </AppPanel>
            )}
          </>
        )}

        {model.status !== "ready" ? (
          <Button asChild variant="outline">
            <Link href={`/app/settings/persona-models/${model.id}/history`}>View Job History</Link>
          </Button>
        ) : null}

        {!model.channelSlug ? (
          <EmptyState
            title="No channel attached"
            description="This persona model is missing its source channel, so it cannot be used in Script Lab."
          />
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  );
}

function StepRow({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string | null;
  state: "done" | "active" | "pending";
}) {
  const icon =
    state === "done" ? (
      <CheckCircle2 className="size-4 text-success" />
    ) : state === "active" ? (
      <LoaderCircle className="size-4 animate-spin text-primary" />
    ) : (
      <div className="size-2 rounded-full bg-placeholder" />
    );

  return (
    <div className="flex items-center gap-3">
      {icon}
      <span className={state === "pending" ? "text-muted-foreground" : "text-foreground"}>{label}</span>
      {detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
    </div>
  );
}
