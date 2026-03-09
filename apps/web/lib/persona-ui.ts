import type { GenerationJobSummary, PersonaModelDetail } from "@ytscan/core";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function getPersonaJobs(model: PersonaModelDetail) {
  return [...model.generationJobs]
    .filter((job) => job.jobType === "persona_train")
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function getLatestPersonaJob(model: PersonaModelDetail) {
  return getPersonaJobs(model)[0] ?? null;
}

export function getPersonaMetrics(job: GenerationJobSummary | null) {
  const output = asRecord(job?.output);
  const metrics = asRecord(output.metrics);
  return metrics;
}

export function getPersonaLaunchPlan(job: GenerationJobSummary | null, model: PersonaModelDetail) {
  const input = asRecord(job?.input);
  const metadata = asRecord(model.metadata);
  return asRecord(input.launchPlan ?? metadata.lambdaLaunchPlan);
}

export function getPersonaProgress(job: GenerationJobSummary | null) {
  return Math.max(0, Math.min(100, Math.round((job?.progress ?? 0) * 100)));
}

export function getPersonaTranscriptsLabel(model: PersonaModelDetail) {
  return model.channelName ? `${model.datasetExamples} training examples` : `${model.datasetExamples}`;
}

export function getPersonaLoss(job: GenerationJobSummary | null) {
  const metrics = getPersonaMetrics(job);
  const value = metrics.train_loss;
  return typeof value === "number" ? value : null;
}

export function getPersonaTrainingMinutes(job: GenerationJobSummary | null) {
  const metrics = getPersonaMetrics(job);
  const runtimeSeconds = metrics.train_runtime;
  if (typeof runtimeSeconds === "number") return Math.max(1, Math.round(runtimeSeconds / 60));

  if (job?.startedAt && job?.completedAt) {
    return Math.max(1, Math.round((Date.parse(job.completedAt) - Date.parse(job.startedAt)) / 60000));
  }

  if (job?.startedAt) {
    return Math.max(1, Math.round((Date.now() - Date.parse(job.startedAt)) / 60000));
  }

  return null;
}

export function getPersonaEstimatedCost(job: GenerationJobSummary | null, model: PersonaModelDetail) {
  const launchPlan = getPersonaLaunchPlan(job, model);
  const centsPerHour = Number(launchPlan.priceCentsPerHour ?? 0);
  if (!Number.isFinite(centsPerHour) || centsPerHour <= 0) return null;

  const minutes = getPersonaTrainingMinutes(job);
  if (!minutes) return null;

  return (centsPerHour / 100) * (minutes / 60);
}

export function formatUsd(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMinutes(value: number | null) {
  if (value === null) return "—";
  return `${value} min`;
}

export function getPersonaStyleMatch(job: GenerationJobSummary | null) {
  const loss = getPersonaLoss(job);
  if (loss === null) return null;
  return Math.max(78, Math.min(98, Math.round(98 - loss * 20)));
}

export function getPersonaSampleText(sampleText: string | null | undefined) {
  const trimmed = sampleText?.trim();
  if (!trimmed) return null;
  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}...` : trimmed;
}
