"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { ChannelSummary, MeResponse } from "@ytscan/core";
import {
  Archive,
  LayoutGrid,
  Menu,
  Plus,
  Settings,
  UploadCloud,
} from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { ChannelAvatar } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { useBackendQuery } from "@/lib/backend-client";
import { initialsFromName } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

type SidebarItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  active: (pathname: string) => boolean;
  bottom?: boolean;
};

const sidebarItems: SidebarItem[] = [
  {
    key: "archive",
    label: "Archive",
    icon: Archive,
    href: "/app/archive",
    active: (pathname) => pathname.startsWith("/app/archive") || pathname.startsWith("/app/transcribe"),
  },
  {
    key: "import",
    label: "Import",
    icon: UploadCloud,
    href: "/app/import",
    active: (pathname) => pathname.startsWith("/app/import") || pathname.startsWith("/app/scans"),
  },
  {
    key: "channels",
    label: "Channels",
    icon: LayoutGrid,
    href: "/app/channels",
    active: (pathname) => pathname.startsWith("/app/channels"),
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    href: "/app/settings/account",
    active: (pathname) => pathname.startsWith("/app/settings"),
    bottom: true,
  },
];

function SidebarLink({
  item,
  pathname,
}: {
  item: SidebarItem;
  pathname: string;
}) {
  const Icon = item.icon;
  const active = item.active(pathname);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-[38px] items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        active && "bg-secondary text-foreground"
      )}
    >
      <Icon className="size-[18px]" />
      <span>{item.label}</span>
    </Link>
  );
}

function WorkspaceSummaryCard({
  workspaceName,
  channelCount,
}: {
  workspaceName: string;
  channelCount: number;
}) {
  const meta =
    channelCount > 0
      ? `${channelCount} imported channel${channelCount === 1 ? "" : "s"}`
      : "No imported channels yet";

  return (
    <div className="flex w-full max-w-full items-center gap-3 overflow-hidden rounded-[12px] border border-border bg-card px-3 py-2.5 text-left shadow-[0_1px_2px_rgb(26_26_24_/_0.04)]">
      <div className="shrink-0">
        <ChannelAvatar channelName={workspaceName} />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-[14px] font-medium text-foreground" title={workspaceName}>
          {workspaceName}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  channels,
  workspaceName,
}: {
  pathname: string;
  channels: ChannelSummary[];
  workspaceName: string;
}) {
  const primaryItems = sidebarItems.filter((item) => !item.bottom);
  const bottomItems = sidebarItems.filter((item) => item.bottom);

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col gap-5 overflow-hidden">
      <div className="grid shrink-0 gap-5">
        <AppLogo href="/app/archive" size="sm" />
        <WorkspaceSummaryCard workspaceName={workspaceName} channelCount={channels.length} />
        <Button asChild className="w-full justify-start">
          <Link href="/app/import">
            <Plus className="size-4" />
            Import Content
          </Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="grid gap-1">
          {primaryItems.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              pathname={pathname}
            />
          ))}
        </nav>
      </div>
      <nav className="grid shrink-0 gap-1 border-t border-separator pt-4">
        {bottomItems.map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            pathname={pathname}
          />
        ))}
      </nav>
    </div>
  );
}

function AccountMenu({
  initials,
  userName,
  userEmail,
}: {
  initials: string;
  userName: string;
  userEmail: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground transition-colors hover:bg-card"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 rounded-[12px] border border-border bg-card p-2 shadow-[0_10px_40px_rgb(26_26_24_/_0.12)]"
      >
        <DropdownMenuLabel className="px-3 py-2">
          <p className="text-[14px] font-semibold text-foreground">{userName}</p>
          <p className="truncate text-[12px] text-muted-foreground">{userEmail}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-[10px] px-3 py-2.5">
          <Link href="/app/settings/account" className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium text-foreground">Settings</p>
              <p className="text-[12px] text-muted-foreground">Profile and preferences</p>
            </div>
            <Settings className="size-4 text-muted-foreground" />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-[10px] px-3 py-2.5 text-[14px] font-medium text-destructive focus:text-destructive"
          onClick={() => void authClient.signOut({ fetchOptions: { onSuccess: () => window.location.assign("/") } })}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AuthenticatedAppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const session = authClient.useSession();
  const me = useBackendQuery<MeResponse>("/me");
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const initials = initialsFromName(session.data?.user.name ?? "YTScan User");
  const items = useMemo(() => channels.data?.items ?? [], [channels.data?.items]);
  const userName = session.data?.user.name ?? "YTScan User";
  const userEmail = session.data?.user.email ?? "";
  const workspaceName = me.data?.workspace.name ?? "Your Workspace";

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="hidden w-72 shrink-0 border-r border-separator bg-background px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col xl:w-[18.5rem]">
        <SidebarContent
          pathname={pathname}
          channels={items}
          workspaceName={workspaceName}
        />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="hidden justify-end border-b border-separator bg-background/95 px-8 py-5 backdrop-blur lg:sticky lg:top-0 lg:z-20 lg:flex xl:px-12">
          <AccountMenu
            initials={initials}
            userName={userName}
            userEmail={userEmail}
          />
        </div>
        <header className="flex h-16 items-center justify-between border-b border-separator bg-background px-4 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] max-w-[280px] border-r border-separator px-4 py-4">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent
                pathname={pathname}
                channels={items}
                workspaceName={workspaceName}
              />
            </SheetContent>
          </Sheet>
          <AppLogo href="/app/archive" size="xs" />
          <Link
            href="/app/settings/account"
            className="inline-flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground"
          >
            {initials}
          </Link>
        </header>
        <div className="min-h-0 flex-1 lg:pb-10">{children}</div>
      </div>
    </div>
  );
}
