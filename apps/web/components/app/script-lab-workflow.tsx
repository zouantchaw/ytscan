import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScriptLabViewStep =
  | "topic_input"
  | "research"
  | "hooks"
  | "script"
  | "director_notes"
  | "thumbnail_brief"
  | "previs";

const workflowSteps: Array<{ id: ScriptLabViewStep; label: string }> = [
  { id: "topic_input", label: "Topic Input" },
  { id: "research", label: "Research" },
  { id: "hooks", label: "Hook Options" },
  { id: "script", label: "Script Draft" },
  { id: "director_notes", label: "Director's Notes" },
  { id: "thumbnail_brief", label: "Thumbnail Brief" },
  { id: "previs", label: "Previsualization" },
];

type WorkflowSidebarProps = {
  activeStep: ScriptLabViewStep;
  channelSlug: string;
  projectId?: string;
  completedSteps?: ScriptLabViewStep[];
};

function getStepHref(
  channelSlug: string,
  activeStep: ScriptLabViewStep,
  projectId?: string
) {
  if (!projectId) {
    return activeStep === "topic_input"
      ? `/app/channels/${channelSlug}/script-lab`
      : undefined;
  }

  return `/app/channels/${channelSlug}/script-lab/${projectId}?step=${activeStep}`;
}

export function ScriptLabWorkflowSidebar({
  activeStep,
  channelSlug,
  projectId,
  completedSteps = [],
}: WorkflowSidebarProps) {
  const completed = new Set(completedSteps);

  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-separator px-6 py-6 lg:sticky lg:top-[89px] lg:flex lg:h-[calc(100dvh-89px)] lg:flex-col lg:self-start">
      <p className="mb-3 shrink-0 text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Workflow
      </p>
      <div className="min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-1">
          {workflowSteps.map((step, index) => {
            const href = getStepHref(channelSlug, step.id, projectId);
            const isActive = step.id === activeStep;
            const isCompleted = completed.has(step.id);

            const content = (
              <>
                <span
                  className={cn(
                    "inline-flex size-[22px] items-center justify-center rounded-full text-[11px] font-semibold",
                    isActive && "bg-primary text-white",
                    isCompleted && !isActive && "bg-success text-white",
                    !isActive && !isCompleted && "bg-secondary text-muted-foreground"
                  )}
                >
                  {isCompleted && !isActive ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span>{step.label}</span>
              </>
            );

            if (!href) {
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 rounded-[10px] px-4 py-3 text-[15px] font-medium transition-colors",
                    isActive && "bg-foreground text-background",
                    isCompleted && !isActive && "text-foreground",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {content}
                </div>
              );
            }

            return (
              <Link
                key={step.id}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] px-4 py-3 text-[15px] font-medium transition-colors",
                  isActive && "bg-foreground text-background hover:text-background",
                  isCompleted && !isActive && "text-foreground hover:bg-secondary",
                  !isActive && !isCompleted && "text-muted-foreground hover:text-foreground"
                )}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
