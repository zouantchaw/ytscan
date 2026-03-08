"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/formatters";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";

type AppTopNavProps = {
  breadcrumbs?: string[];
  channelSlug?: string;
  showTabs?: boolean;
  backHref?: string;
  backLabel?: string;
  rightHref?: string;
  rightLabel?: string;
  scanTone?: "solid" | "tint" | "outline";
  scanLabel?: string;
  className?: string;
  hideAvatar?: boolean;
};

const tabDefinitions = [
  { label: "Dashboard", suffix: "" },
  { label: "Search", suffix: "/search" },
  { label: "Compare", suffix: "/compare" },
  { label: "Script Lab", suffix: "/script-lab" },
  { label: "Thumbnails", suffix: "/thumbnails" },
];

export function AppTopNav({
  breadcrumbs,
  channelSlug,
  showTabs = false,
  backHref,
  backLabel,
  rightHref,
  rightLabel,
  scanTone = "tint",
  scanLabel,
  className,
  hideAvatar = false,
}: AppTopNavProps) {
  const pathname = usePathname();
  const session = authClient.useSession();
  const userName = session.data?.user.name ?? "YTScan User";
  const initials = initialsFromName(userName);
  const tabs = channelSlug
    ? tabDefinitions.map((tab) => ({
        ...tab,
        href:
          tab.label === "Script Lab"
            ? `/app/channels/${channelSlug}/script-lab/projects`
            : `/app/channels/${channelSlug}${tab.suffix}`,
      }))
    : [];
  const resolvedScanLabel = scanLabel ?? (showTabs ? "+ Scan Channel" : "+ Scan New Channel");
  const scanVariant =
    scanTone === "solid" ? "default" : scanTone === "outline" ? "outline" : "subtle";
  const shouldShowScanAction = !backHref && !breadcrumbs?.length && !rightHref;

  return (
    <header className={cn("border-b border-separator bg-background", className)}>
      <div
        className={cn(
          "flex h-[65px] items-center justify-between gap-6",
          showTabs ? "px-8" : "px-6 md:px-10 xl:px-12"
        )}
      >
        <div className="flex items-center gap-6">
          <AppLogo size={showTabs ? "xs" : "xs"} />
          {showTabs ? (
            <nav className="hidden items-center gap-1 md:flex">
              {tabs.map((tab) => {
                const active =
                  tab.suffix === ""
                    ? pathname === tab.href
                    : tab.label === "Script Lab"
                      ? pathname.includes("/script-lab")
                      : pathname.startsWith(tab.href);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "rounded-[8px] px-4 py-2 text-[13px] leading-4 text-[#6b6b66] transition-colors",
                      active && "bg-foreground text-background",
                      !active && "hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          ) : backHref && backLabel && !breadcrumbs?.length ? (
            <Link
              href={backHref}
              className="hidden items-center gap-2 text-[14px] font-medium text-[#6b6b66] hover:text-foreground md:inline-flex"
            >
              <ChevronLeft className="size-4" />
              {backLabel}
            </Link>
          ) : breadcrumbs?.length ? (
            <div className="hidden items-center gap-2 text-[14px] md:flex">
              {breadcrumbs.map((item, index) => (
                <span key={`${item}-${index}`} className={cn(index === breadcrumbs.length - 1 ? "font-medium text-foreground" : "text-[#9b9b96]")}>
                  {index > 0 ? <span className="mr-2 text-[#d4d0c8]">/</span> : null}
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {rightHref && rightLabel ? (
            <Link
              href={rightHref}
              className="hidden items-center gap-2 text-[14px] font-medium text-[#6b6b66] hover:text-foreground md:inline-flex"
            >
              {rightLabel}
            </Link>
          ) : null}
          {shouldShowScanAction ? (
            <Button
              asChild
              variant={scanVariant}
              size="sm"
              className={cn(
                "h-9 rounded-[8px] px-4 text-[13px] font-medium",
                scanTone === "solid" && "bg-primary text-white shadow-none hover:bg-primary/95",
                scanTone === "tint" && "bg-accent text-primary hover:bg-accent",
                scanTone === "outline" && "border-primary text-primary hover:bg-accent"
              )}
            >
              <Link href="/app/scans/new">{resolvedScanLabel}</Link>
            </Button>
          ) : null}
          {hideAvatar ? null : (
            <Link
              href="/app/settings"
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold",
                showTabs ? "bg-[#d4d0c8] text-foreground" : "bg-[#e8e6e1] text-foreground"
              )}
            >
              {initials}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
