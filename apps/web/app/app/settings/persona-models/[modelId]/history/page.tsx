"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useParams } from "next/navigation";
import type { PersonaModelResponse } from "@ytscan/core";
import { AppPanel, ErrorState } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";
import { formatRelativeDate } from "@/lib/formatters";
import {
  formatMinutes,
  formatUsd,
  getPersonaEstimatedCost,
  getPersonaJobs,
  getPersonaLaunchPlan,
  getPersonaLoss,
  getPersonaTrainingMinutes,
} from "@/lib/persona-ui";
import { cn } from "@/lib/utils";

function getCompletedRunCount(statuses: string[]) {
  return statuses.filter((status) => status === "completed").length;
}

function getRunLabel({
  job,
  version,
  isCurrent,
  failureIndex,
}: {
  job: NonNullable<ReturnType<typeof getPersonaJobs>[number]>;
  version: number | null;
  isCurrent: boolean;
  failureIndex: number;
}) {
  if (job.status === "completed" && version !== null) {
    return isCurrent ? `v${version} — Current` : `v${version}`;
  }

  if (job.status === "failed") {
    return `Failed Run #${failureIndex}`;
  }

  return "Training Run";
}

function getRunStatusLabel(status: string, isCurrent: boolean) {
  if (status === "completed") return isCurrent ? "ACTIVE" : "REPLACED";
  if (status === "failed") return "FAILED";
  if (status === "running" || status === "training" || status === "queued" || status === "provisioning") {
    return "RUNNING";
  }
  return status.toUpperCase();
}

function getStatusTone(status: string, isCurrent: boolean) {
  if (status === "completed") {
    return isCurrent
      ? {
          dot: "bg-success",
          card: "border-success/60 bg-card shadow-[inset_0_0_0_1px_rgb(87_163_122_/_0.18)]",
          pill: "bg-success/10 text-success",
          accent: "text-success",
        }
      : {
          dot: "bg-success",
          card: "border-border bg-card",
          pill: "bg-secondary text-muted-foreground",
          accent: "text-foreground",
        };
  }

  if (status === "failed") {
    return {
      dot: "bg-destructive",
      card: "border-border bg-card",
      pill: "bg-destructive/10 text-destructive",
      accent: "text-destructive",
    };
  }

  return {
    dot: "bg-[#E3A234]",
    card: "border-border bg-card",
    pill: "bg-[#E3A234]/10 text-[#E3A234]",
    accent: "text-foreground",
  };
}

export default function PersonaModelHistoryPage() {
  const params = useParams<{ modelId: string }>();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const response = useBackendQuery<PersonaModelResponse>(
    `/persona-models/${encodeURIComponent(params.modelId)}`,
    { pollMs: 5000 }
  );

  const model = response.data?.personaModel ?? null;

  if (response.error) {
    return (
      <main className="app-page pb-10 pt-4 lg:pt-0">
        <ErrorState
          title="Persona history unavailable"
          description="We couldn't load the training history for this persona model. Retry the page and try again."
          action={<Button onClick={() => response.refetch()}>Retry</Button>}
        />
      </main>
    );
  }

  async function handleTrainNewVersion() {
    if (!model) return;
    setError(null);
    startTransition(async () => {
      try {
        await fetchBackend(`/persona-models/${model.id}/train`, {
          method: "POST",
          body: JSON.stringify({ launchInstance: true }),
        });
        response.refetch();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to start a new version.");
      }
    });
  }

  if (!model) {
    return (
      <main className="app-page pb-10 pt-4 lg:pt-0">
        <AppPanel className="h-[420px] max-w-[1104px]" />
      </main>
    );
  }

  const jobs = getPersonaJobs(model);
  const completedRuns = jobs.filter((job) => job.status === "completed");
  const currentCompletedId = completedRuns[0]?.id ?? null;
  const totalSpend = jobs.reduce((sum, job) => sum + (getPersonaEstimatedCost(job, model) ?? 0), 0);
  let remainingCompletedVersion = getCompletedRunCount(jobs.map((job) => job.status));
  let failedIndex = jobs.filter((job) => job.status === "failed").length;

  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
              {model.channelName} Voice Model
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              Training job history · {jobs.length} run{jobs.length === 1 ? "" : "s"} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href={`/app/settings/persona-models/${model.id}`}>Back to Model</Link>
            </Button>
            <Button onClick={handleTrainNewVersion} disabled={isPending || model.status === "training"}>
              {isPending ? "Starting..." : "+ Train New Version"}
            </Button>
          </div>
        </section>

        <section className="grid gap-4">
          {jobs.map((job) => {
            const isCompleted = job.status === "completed";
            const version = isCompleted ? remainingCompletedVersion-- : null;
            const isCurrent = job.id === currentCompletedId;
            const label = getRunLabel({ job, version, isCurrent, failureIndex: failedIndex });
            if (job.status === "failed") failedIndex -= 1;

            const tone = getStatusTone(job.status, isCurrent);
            const loss = getPersonaLoss(job);
            const minutes = getPersonaTrainingMinutes(job);
            const cost = getPersonaEstimatedCost(job, model);
            const launchPlan = getPersonaLaunchPlan(job, model);
            const transcriptCount = String(job.output?.datasetExamples ?? model.datasetExamples);
            const dateLabel = job.completedAt ?? job.startedAt ?? job.createdAt;

            return (
              <AppPanel
                key={job.id}
                className={cn(
                  "grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] lg:items-center",
                  tone.card
                )}
              >
                <div className="flex items-start gap-4">
                  <span className={cn("mt-1 size-3 rounded-full", tone.dot)} />
                  <div className="space-y-1">
                    <p className="text-[18px] font-semibold tracking-[-0.03em] text-foreground">{label}</p>
                    <p className="text-[14px] text-muted-foreground">
                      {formatRelativeDate(dateLabel)} · {transcriptCount} transcripts
                    </p>
                    {job.status !== "completed" && job.message ? (
                      <p className="max-w-[560px] text-[13px] leading-6 text-muted-foreground">{job.message}</p>
                    ) : null}
                    {job.status === "failed" && job.errorMessage ? (
                      <p className="max-w-[560px] text-[13px] leading-6 text-destructive">{job.errorMessage}</p>
                    ) : null}
                    {job.status === "running" || job.status === "training" ? (
                      <p className="text-[13px] text-muted-foreground">
                        {String(launchPlan.instanceTypeName ?? "Lambda instance")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <MetricCell label="Loss" value={loss !== null ? loss.toFixed(3) : "—"} accent={tone.accent} />
                <MetricCell label="Time" value={formatMinutes(minutes)} />
                <MetricCell label="Cost" value={formatUsd(cost)} accent={job.status === "failed" ? "text-destructive" : "text-foreground"} />
                <div className="justify-self-start lg:justify-self-end">
                  <span className={cn("inline-flex rounded-[8px] px-3 py-1.5 text-[12px] font-medium", tone.pill)}>
                    {getRunStatusLabel(job.status, isCurrent)}
                  </span>
                </div>
              </AppPanel>
            );
          })}
        </section>

        <div className="flex items-center justify-between border-t border-separator pt-4">
          <p className="text-[15px] text-muted-foreground">Total spend across all runs</p>
          <p className="font-display text-[32px] font-semibold tracking-[-0.05em] text-foreground">
            {formatUsd(totalSpend)}
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  );
}

function MetricCell({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="grid gap-1 text-left lg:min-w-[74px] lg:text-right">
      <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={cn("text-[16px] font-semibold", accent)}>{value}</p>
    </div>
  );
}
