"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  ChannelDashboard,
  PersonaModelListResponse,
  ScriptProjectResponse,
} from "@ytscan/core";
import { AppPanel, ChannelAvatar } from "@/components/app/app-ui";
import { ScriptLabWorkflowSidebar } from "@/components/app/script-lab-workflow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchBackend, useBackendQuery } from "@/lib/backend-client";

export default function ScriptLabTopicPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const seededTopic = searchParams.get("topic")?.trim() ?? "";
  const [topic, setTopic] = useState(seededTopic);
  const [usePersonaModel, setUsePersonaModel] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const channel = useBackendQuery<ChannelDashboard>(
    `/channels/${encodeURIComponent(slug)}`
  );
  const personaModels = useBackendQuery<PersonaModelListResponse>("/persona-models");
  const activePersona = personaModels.data?.items.find(
    (item) => item.channelSlug === slug && item.status !== "failed"
  );

  async function createProject(runResearch: boolean) {
    if (!topic.trim()) {
      setError("Add a topic or idea to continue.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetchBackend<ScriptProjectResponse>("/script-lab/projects", {
          method: "POST",
          body: JSON.stringify({
            channelSlug: slug,
            status: "draft",
            title: topic.trim(),
            topic: topic.trim(),
          }),
        });

        if (runResearch) {
          await fetchBackend(`/script-lab/projects/${response.project.id}/research`, {
            method: "POST",
            body: JSON.stringify({
              usePersonaModel,
            }),
          });
        }

        router.push(
          runResearch
            ? `/app/channels/${slug}/script-lab/${response.project.id}?step=research`
            : `/app/channels/${slug}/script-lab/${response.project.id}?step=topic_input`
        );
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to create the project.");
      }
    });
  }

  return (
    <main className="flex min-h-[calc(100vh-69px)]">
      <ScriptLabWorkflowSidebar activeStep="topic_input" channelSlug={slug} />

      <section className="flex-1 px-6 py-12 md:px-10 xl:px-20 xl:py-[60px]">
        <div className="max-w-[1000px] space-y-10">
          <div className="space-y-2">
            <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
              New Script
            </h1>
            <p className="max-w-[760px] text-[16px] leading-8 text-muted-foreground">
              Tell us what you want to create. We&apos;ll research your channel&apos;s best content and write a script in your voice.
            </p>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-3">
              <label className="text-[15px] font-medium text-foreground">Topic or idea</label>
              <Textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder='e.g. "How to buy a car wash for under $50K" or "The hidden business nobody talks about"'
                className="min-h-[106px] rounded-[12px] border-input bg-card px-4 py-4 text-[16px] leading-7 shadow-none focus-visible:ring-4 focus-visible:ring-ring/12"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
              <div className="grid gap-3">
                <label className="text-[15px] font-medium text-foreground">Channel</label>
                <AppPanel className="flex items-center justify-between gap-4 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <ChannelAvatar
                      channelName={channel.data?.channelName ?? "Channel"}
                      channelSlug={slug}
                    />
                    <span className="text-[15px] font-medium text-foreground">
                      {channel.data?.channelName ?? "Loading channel..."}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">Change</span>
                </AppPanel>
              </div>

              <div className="grid gap-3">
                <label className="text-[15px] font-medium text-foreground">Target duration</label>
                <AppPanel className="flex items-center justify-between gap-4 px-4 py-4">
                  <span className="text-[15px] font-medium text-foreground">
                    {channel.data?.stats.bestDuration?.label ?? "12-18 min"}
                  </span>
                  <span className="text-sm text-muted-foreground">Sweet spot</span>
                </AppPanel>
              </div>
            </div>

            <AppPanel className="flex items-center justify-between gap-4 bg-accent/40 px-6 py-5">
              <div>
                <p className="text-[15px] font-semibold text-foreground">Use Persona Model</p>
                <p className="text-sm text-muted-foreground">
                  {activePersona
                    ? `Write in ${channel.data?.channelName ?? "this creator"}'s voice using ${activePersona.baseModel}`
                    : "Write in the creator's voice using the best available retrieval context."}
                </p>
              </div>
              <button
                type="button"
                aria-pressed={usePersonaModel}
                onClick={() => setUsePersonaModel((current) => !current)}
                className="inline-flex h-8 w-12 items-center rounded-full bg-primary/20 p-1"
              >
                <span
                  className={`size-6 rounded-full bg-white shadow-sm transition-transform ${
                    usePersonaModel ? "translate-x-4 bg-primary" : "translate-x-0"
                  }`}
                />
              </button>
            </AppPanel>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => createProject(true)} disabled={isPending}>
                {isPending ? "Starting..." : "Start Research"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => createProject(false)}
                disabled={isPending}
              >
                Save as Draft
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
