"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  ChannelSummary,
  PersonaModelDetail,
  PersonaModelListResponse,
  PersonaModelResponse,
  PersonaModelSummary,
} from "@ytscan/core";
import { AppTopNav } from "@/components/app/app-top-nav";
import { AppPanel, ChannelAvatar } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";
import { cn } from "@/lib/utils";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

function getStatusTone(status: string) {
  if (status === "ready") return { dot: "bg-success", text: "text-success", label: "Ready" };
  if (status === "training" || status === "queued" || status === "running") {
    return { dot: "bg-[#E3A234]", text: "text-[#E3A234]", label: "Training" };
  }
  return { dot: "bg-placeholder", text: "text-muted-foreground", label: "Untrained" };
}

function getLatestProgress(model: PersonaModelDetail | null) {
  const latestJob = model?.generationJobs.find((job) => job.jobType === "persona_train") ?? null;
  if (!latestJob) return null;
  return Math.round(latestJob.progress * 100);
}

export default function PersonaModelsPage() {
  const [activeJobKey, setActiveJobKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const personaModels = useBackendQuery<PersonaModelListResponse>("/persona-models", {
    pollMs: 5000,
  });

  const modelByChannel = useMemo(() => {
    return new Map((personaModels.data?.items ?? []).map((item) => [item.channelSlug ?? "", item]));
  }, [personaModels.data?.items]);

  const rows = useMemo(() => {
    return (channels.data?.items ?? []).map((channel) => ({
      channel,
      model: modelByChannel.get(channel.slug) ?? null,
    }));
  }, [channels.data?.items, modelByChannel]);

  const untrainedChannel = rows.find((row) => !row.model)?.channel ?? null;

  function runTrainFlow(channelSlug: string, existingModel?: PersonaModelSummary | null) {
    setError(null);
    setActiveJobKey(channelSlug);
    startTransition(async () => {
      try {
        const model =
          existingModel ??
          (
            await fetchBackend<PersonaModelResponse>("/persona-models", {
              method: "POST",
              body: JSON.stringify({ channelSlug }),
            })
          ).personaModel;

        await fetchBackend<PersonaModelResponse>(`/persona-models/${model.id}/train`, {
          method: "POST",
          body: JSON.stringify({ launchInstance: true }),
        });

        personaModels.refetch();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to start training.");
      } finally {
        setActiveJobKey(null);
      }
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppTopNav breadcrumbs={["Settings", "Persona Models"]} />
      <main className="app-page py-9">
        <div className="grid gap-8">
          <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h1 className="font-display text-[30px] font-bold tracking-[-0.04em] text-foreground">
                Persona Models
              </h1>
              <p className="text-[14px] leading-6 text-muted-foreground">
                LoRA fine-tuned models that capture each channel&apos;s writing voice.
              </p>
            </div>
            <Button
              onClick={() => untrainedChannel && runTrainFlow(untrainedChannel.slug)}
              disabled={!untrainedChannel || isPending}
            >
              + Train New Model
            </Button>
          </section>

          <section className="grid gap-4">
            {rows.map(({ channel, model }) => (
              <PersonaModelRow
                key={channel.slug}
                channel={channel}
                model={model}
                isPending={isPending && activeJobKey === channel.slug}
                onTrain={() => runTrainFlow(channel.slug, model)}
              />
            ))}
          </section>

          <AppPanel className="bg-secondary px-5 py-5">
            <p className="text-[13px] leading-6 text-muted-foreground">
              Training uses Lambda Labs compute. Estimated cost is roughly $5–15 per model, with
              around 1–2 hours of training time depending on corpus size and base model.
            </p>
          </AppPanel>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}

function PersonaModelRow({
  channel,
  model,
  isPending,
  onTrain,
}: {
  channel: ChannelSummary;
  model: PersonaModelSummary | null;
  isPending: boolean;
  onTrain: () => void;
}) {
  const detail = useBackendQuery<PersonaModelResponse>(
    model ? `/persona-models/${encodeURIComponent(model.id)}` : null,
    {
      enabled: Boolean(model),
      pollMs:
        model?.status === "training" || model?.status === "queued" || model?.status === "running"
          ? 5000
          : null,
    }
  );
  const progress = getLatestProgress(detail.data?.personaModel ?? null);
  const status = model?.status ?? "untrained";
  const statusTone = getStatusTone(status);
  const baseModel = model?.baseModel
    ? model.baseModel.split("/").at(-1)?.replace("-Instruct", "") ?? model.baseModel
    : "—";

  return (
    <AppPanel id={`model-${model?.id ?? channel.slug}`} className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center">
      <ChannelAvatar channelName={channel.channelName} channelSlug={channel.slug} size="lg" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-display text-[18px] font-semibold tracking-[-0.03em] text-foreground">
          {channel.channelName}
        </p>
        <p className="text-[13px] text-muted-foreground">
          {model
            ? `${channel.totalVideos} transcripts · ${model.datasetExamples} training examples`
            : `${channel.totalVideos} transcripts · Not yet trained`}
        </p>
      </div>
      <div className="w-full space-y-1 lg:w-[140px] lg:text-right">
        <p className="text-[13px] font-medium text-foreground">{baseModel}</p>
        <p className="text-[12px] text-muted-foreground">
          {model ? `Provider: ${model.provider}` : "Select base model"}
        </p>
      </div>
      <div className="flex w-full items-center gap-2 lg:w-[110px]">
        <span className={cn("size-2 rounded-full", statusTone.dot)} />
        <span className={cn("text-[13px] font-medium", statusTone.text)}>
          {statusTone.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {model && progress !== null && status !== "ready" ? (
          <span className="rounded-[6px] bg-secondary px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
            {progress}%
          </span>
        ) : null}
        <Button variant={model ? "outline" : "default"} size="sm" onClick={onTrain} disabled={isPending}>
          {isPending ? "Starting..." : model ? "Retrain" : "Train"}
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`#model-${model?.id ?? channel.slug}`}>Details</a>
        </Button>
      </div>
    </AppPanel>
  );
}
