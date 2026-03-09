import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2, Link2Off, Mail, ShieldAlert } from "lucide-react";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthStateTone = "success" | "warning" | "error" | "neutral";

type AuthStateAction = {
  href: string;
  label: string;
  variant?: "default" | "outline" | "ghost";
};

type AuthStateShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  detail?: string;
  tone?: AuthStateTone;
  icon?: LucideIcon;
  primaryAction?: AuthStateAction;
  secondaryAction?: AuthStateAction;
};

const toneClasses: Record<AuthStateTone, string> = {
  success: "bg-[rgb(74_155_110_/_0.12)] text-success ring-[rgb(74_155_110_/_0.18)]",
  warning: "bg-[rgb(227_167_57_/_0.14)] text-[#a8741b] ring-[rgb(227_167_57_/_0.18)]",
  error: "bg-[rgb(201_53_41_/_0.12)] text-destructive ring-[rgb(201_53_41_/_0.18)]",
  neutral: "bg-secondary text-foreground ring-border",
};

const toneIcons: Record<AuthStateTone, LucideIcon> = {
  success: CheckCircle2,
  warning: ShieldAlert,
  error: Link2Off,
  neutral: Mail,
};

export function AuthStateShell({
  eyebrow,
  title,
  description,
  detail,
  tone = "neutral",
  icon,
  primaryAction,
  secondaryAction,
}: AuthStateShellProps) {
  const Icon = icon ?? toneIcons[tone];

  return (
    <main className="grid min-h-screen bg-background md:grid-cols-[560px_1fr]">
      <AuthBrandPanel
        title={"Scan any channel.\nKnow what works.\nCreate what's next."}
        description="YouTube content intelligence for creators and teams who want data-driven decisions, not gut feelings."
      />
      <section className="flex items-center justify-center px-6 py-14 md:px-12">
        <div className="w-full max-w-[460px] space-y-8">
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9b9b96]">
              {eyebrow}
            </p>
            <h1 className="font-display text-[38px] font-semibold leading-[1.04] tracking-[-0.04em] text-foreground md:text-[44px]">
              {title}
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">{description}</p>
          </div>

          <div className="rounded-[18px] border border-border bg-card px-6 py-7 shadow-[0_1px_2px_rgb(26_26_24_/_0.04)]">
            <div className="space-y-5">
              <div
                className={cn(
                  "inline-flex size-14 items-center justify-center rounded-[18px] ring-1",
                  toneClasses[tone]
                )}
              >
                <Icon className="size-6" />
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-[28px] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
                  {title}
                </h2>
                <p className="text-[15px] leading-7 text-muted-foreground">{description}</p>
                {detail ? (
                  <p className="rounded-[12px] bg-secondary px-4 py-3 text-[14px] leading-6 text-foreground">
                    {detail}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                {primaryAction ? (
                  <Button asChild size="lg" className="min-w-[180px]">
                    <Link href={primaryAction.href}>
                      {primaryAction.label}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : null}
                {secondaryAction ? (
                  <Button
                    asChild
                    size="lg"
                    variant={secondaryAction.variant ?? "outline"}
                    className="min-w-[180px]"
                  >
                    <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
