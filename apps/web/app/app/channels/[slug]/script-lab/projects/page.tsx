"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import type { ScriptProjectListResponse, ScriptProjectSummary } from "@ytscan/core";
import { AppPanel, EmptyState } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { useBackendQuery } from "@/lib/backend-client";
import { formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function getProjectStep(project: ScriptProjectSummary) {
  if (project.latestOutputStep === "previs" || project.status === "completed") {
    return { label: "Complete", tone: "complete" as const, action: "Open →" };
  }

  const mapping: Record<string, number> = {
    hooks: 3,
    outline: 4,
    script: 4,
    director_notes: 5,
    thumbnail_brief: 6,
    previs: 7,
  };

  if (project.latestOutputStep && mapping[project.latestOutputStep]) {
    return {
      label: `Step ${mapping[project.latestOutputStep]} of 7`,
      tone: "progress" as const,
      action: "Resume →",
    };
  }

  if (project.researchItemCount > 0) {
    return { label: "Step 2 of 7", tone: "progress" as const, action: "Resume →" };
  }

  return { label: "Draft", tone: "draft" as const, action: "Open →" };
}

function getProjectMeta(project: ScriptProjectSummary) {
  const pieces = [project.channelName ?? "Unassigned"];
  if (project.researchItemCount > 0) {
    pieces.push(`${project.researchItemCount} research items`);
  }
  pieces.push(`Updated ${formatRelativeDate(project.updatedAt)}`);
  return pieces.join(" · ");
}

export default function ScriptLabProjectsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const projects = useBackendQuery<ScriptProjectListResponse>("/script-lab/projects");
  const channelProjects = useMemo(() => {
    return (projects.data?.items ?? []).filter((project) => project.channelSlug === slug);
  }, [projects.data?.items, slug]);

  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] grid gap-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
              Script Lab
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              AI-powered scripts written in your channel&apos;s voice
            </p>
          </div>
          <Button asChild>
            <Link href={`/app/channels/${slug}/script-lab`}>+ New Script</Link>
          </Button>
        </section>

        {channelProjects.length ? (
          <section className="grid gap-4">
            {channelProjects.map((project) => (
              <ProjectRow key={project.id} project={project} slug={slug} />
            ))}
          </section>
        ) : (
          <div className="flex min-h-[680px] items-center justify-center">
            <EmptyState
              title="No scripts yet"
              description="Create your first AI-powered script based on your channel's voice and top-performing content patterns."
              actionLabel="+ New Script"
              actionHref={`/app/channels/${slug}/script-lab`}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function ProjectRow({
  project,
  slug,
}: {
  project: ScriptProjectSummary;
  slug: string;
}) {
  const step = getProjectStep(project);

  return (
    <AppPanel className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-[10px] bg-accent text-[18px] text-primary/70">
          S
        </div>
        <div className="space-y-1">
          <p className="text-[15px] font-semibold text-foreground">{project.title}</p>
          <p className="text-[13px] text-muted-foreground">{getProjectMeta(project)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em]",
            step.tone === "complete"
              ? "bg-success text-white"
              : step.tone === "progress"
                ? "bg-success/10 text-success"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {step.tone === "complete" ? "Complete" : step.label}
        </span>
        <Link
          href={`/app/channels/${slug}/script-lab/${project.id}${step.tone === "complete" ? "" : "?step=research"}`}
          className={cn(
            "text-[13px] font-medium hover:text-primary/80",
            step.tone === "progress" ? "text-primary" : "text-primary"
          )}
        >
          {step.tone === "progress" ? "Resume →" : "Open →"}
        </Link>
      </div>
    </AppPanel>
  );
}
