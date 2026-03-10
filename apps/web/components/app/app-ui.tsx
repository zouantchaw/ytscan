import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { type MetricDelta } from "@ytscan/core";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatCompactNumber,
  formatPercent,
  formatSignedRatio,
  formatWeeklyRate,
  humanizeTier,
} from "@/lib/formatters";
import {
  getChannelAccent,
  getChannelInitials,
  getVideoThumbnailUrl,
} from "@/lib/channel-ui";

export function AppPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-border bg-card shadow-[0_1px_2px_rgb(26_26_24_/_0.04)]",
        className
      )}
      {...props}
    />
  );
}

type ChannelAvatarProps = {
  channelName: string;
  channelSlug?: string | null;
  size?: "default" | "lg";
};

export function ChannelAvatar({
  channelName,
  channelSlug,
  size = "default",
}: ChannelAvatarProps) {
  return (
    <Avatar
      size={size}
      className={cn(
        "after:hidden",
        size === "lg" && "size-[52px] text-base",
        size === "default" && "size-10",
        getChannelAccent(channelSlug)
      )}
    >
      <AvatarFallback className={cn("bg-transparent font-semibold text-current")}>
        {getChannelInitials(channelName)}
      </AvatarFallback>
    </Avatar>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  detailTone?: "neutral" | "success" | "primary" | "destructive";
};

export function MetricCard({
  label,
  value,
  detail,
  detailTone = "neutral",
}: MetricCardProps) {
  return (
    <AppPanel className="flex flex-col gap-1.5 px-6 py-5">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-[28px] font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </p>
      <p
        className={cn(
          "text-sm leading-5 text-muted-foreground",
          detailTone === "success" && "text-success",
          detailTone === "primary" && "text-primary",
          detailTone === "destructive" && "text-destructive"
        )}
      >
        {detail}
      </p>
    </AppPanel>
  );
}

export function TierBadge({
  tier,
  className,
}: {
  tier: string | null | undefined;
  className?: string;
}) {
  const normalized = (tier ?? "average").toLowerCase();
  const variant =
    normalized === "viral"
      ? "destructive"
      : normalized === "strong"
        ? "success"
        : "secondary";

  return (
    <Badge variant={variant} className={cn("rounded-[6px] px-2 py-0.5 text-[11px]", className)}>
      {humanizeTier(tier)}
    </Badge>
  );
}

export function VideoThumbnail({
  youtubeId,
  title,
  className,
  aspect = "video",
}: {
  youtubeId: string;
  title: string;
  className?: string;
  aspect?: "video" | "card";
}) {
  return (
    <Image
      src={getVideoThumbnailUrl(youtubeId)}
      alt={title}
      width={1280}
      height={720}
      className={cn(
        "w-full rounded-[10px] border border-border object-cover",
        aspect === "video" ? "aspect-video" : "aspect-[1.78/1]",
        className
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <AppPanel className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="space-y-2">
        <h2 className="font-display text-[30px] font-semibold tracking-[-0.04em] text-foreground">
          {title}
        </h2>
        <p className="max-w-[480px] text-[15px] leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
      {actionLabel && actionHref ? (
        <Button asChild size="lg">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </AppPanel>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <AppPanel className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" />
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-[30px] font-semibold tracking-[-0.04em] text-foreground">
          {title}
        </h2>
        <p className="max-w-[520px] text-[15px] leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </AppPanel>
  );
}

export function PageLoading({
  cards = 3,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-6 md:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: cards }).map((_, index) => (
        <AppPanel key={index} className="overflow-hidden">
          <Skeleton className="h-[120px] w-full rounded-none" />
          <div className="grid gap-4 px-6 py-5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </AppPanel>
      ))}
    </div>
  );
}

export function MetricDetail({
  metric,
  type,
}: {
  metric: MetricDelta;
  type: "views" | "rate" | "cadence";
}) {
  if (type === "views") {
    return {
      value: formatCompactNumber(metric.current),
      detail: `${formatSignedRatio(metric.deltaPct, 0)} vs prior 30 videos`,
      detailTone: metric.delta >= 0 ? "success" : "destructive",
    } as const;
  }

  if (type === "rate") {
    return {
      value: formatPercent(metric.current),
      detail: metric.previous
        ? `${formatSignedRatio(metric.deltaPct, 1)} vs prior window`
        : "Early signal for this channel",
      detailTone: metric.delta >= 0 ? "success" : "destructive",
    } as const;
  }

  return {
    value: formatWeeklyRate(metric.current),
    detail: metric.previous
      ? `${metric.delta >= 0 ? "Up" : "Down"} from ${formatWeeklyRate(metric.previous)}`
      : "Early signal for this channel",
    detailTone: metric.delta >= 0 ? "success" : "destructive",
  } as const;
}

export function VideoMetaLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      {children}
      <ExternalLink className="size-3.5" />
    </a>
  );
}
