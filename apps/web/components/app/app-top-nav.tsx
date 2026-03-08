"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/formatters";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";

type AppTopNavProps = {
  channelSlug?: string;
  showTabs?: boolean;
  backHref?: string;
  backLabel?: string;
};

const tabDefinitions = [
  { label: "Dashboard", suffix: "" },
  { label: "Search", suffix: "/search" },
  { label: "Compare", suffix: "/compare" },
  { label: "Script Lab", suffix: "/script-lab" },
  { label: "Thumbnails", suffix: "/thumbnails" },
];

export function AppTopNav({
  channelSlug,
  showTabs = false,
  backHref,
  backLabel,
}: AppTopNavProps) {
  const pathname = usePathname();
  const session = authClient.useSession();
  const userName = session.data?.user.name ?? "YTScan User";
  const initials = initialsFromName(userName);
  const tabs = channelSlug
    ? tabDefinitions.map((tab) => ({
        ...tab,
        href: `/app/channels/${channelSlug}${tab.suffix}`,
      }))
    : [];
  const scanLabel = showTabs ? "+ Scan Channel" : "+ Scan New Channel";

  return (
    <header className="border-b border-separator bg-background">
      <div className="app-page flex h-[69px] items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <AppLogo size="sm" />
          {showTabs ? (
            <nav className="hidden items-center gap-2 md:flex">
              {tabs.map((tab) => {
                const active =
                  tab.suffix === ""
                    ? pathname === tab.href
                    : pathname.startsWith(tab.href);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "rounded-[8px] px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors",
                      active && "bg-foreground text-background",
                      !active && "hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          ) : backHref && backLabel ? (
            <Link
              href={backHref}
              className="hidden items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground md:inline-flex"
            >
              <ChevronLeft className="size-4" />
              {backLabel}
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="subtle" size="sm">
            <Link href="/app/scans/new">
              {scanLabel}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" aria-label="Settings">
            <Link href="/app/settings">
              <Settings className="size-4" />
            </Link>
          </Button>
          <Link
            href="/app/settings"
            className="inline-flex size-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
}
