"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import type { ChannelSummary, MeResponse } from "@ytscan/core";
import {
  ChevronDown,
  FolderKanban,
  LayoutGrid,
  Menu,
  Search,
  Settings,
  Sparkles,
  UserSquare2,
  UsersRound,
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
  href: (channelSlug: string | null) => string;
  active: (pathname: string) => boolean;
  bottom?: boolean;
};

const LAST_CHANNEL_SLUG_KEY = "ytscan:last-channel-slug";

const sidebarItems: SidebarItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    href: (channelSlug) => (channelSlug ? `/app/channels/${channelSlug}` : "/app/channels"),
    active: (pathname) =>
      /^\/app\/channels\/[^/]+$/.test(pathname) || pathname === "/app/channels",
  },
  {
    key: "search",
    label: "Search",
    icon: Search,
    href: (channelSlug) =>
      channelSlug ? `/app/channels/${channelSlug}/search` : "/app/channels",
    active: (pathname) => pathname.includes("/search"),
  },
  {
    key: "script-lab",
    label: "Script Lab",
    icon: Sparkles,
    href: (channelSlug) =>
      channelSlug ? `/app/channels/${channelSlug}/script-lab/projects` : "/app/channels",
    active: (pathname) => pathname.includes("/script-lab"),
  },
  {
    key: "persona",
    label: "Persona",
    icon: UserSquare2,
    href: () => "/app/persona",
    active: (pathname) => pathname.startsWith("/app/persona") || pathname.includes("/persona-models"),
  },
  {
    key: "compare",
    label: "Compare",
    icon: UsersRound,
    href: (channelSlug) =>
      channelSlug ? `/app/channels/${channelSlug}/compare` : "/app/channels",
    active: (pathname) => pathname.includes("/compare"),
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    href: () => "/app/settings/account",
    active: (pathname) => pathname.startsWith("/app/settings"),
    bottom: true,
  },
];

function resolvePreferredChannelSlug(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
  channels: ChannelSummary[],
  rememberedChannelSlug: string | null
) {
  const routeSlug = params.slug;
  if (typeof routeSlug === "string") return routeSlug;

  if (rememberedChannelSlug && channels.some((channel) => channel.slug === rememberedChannelSlug)) {
    return rememberedChannelSlug;
  }

  if (channels.length === 1) {
    return channels[0]?.slug ?? null;
  }

  if (pathname.startsWith("/app/channels/") || pathname.startsWith("/app/scans")) {
    return null;
  }

  return null;
}

function SidebarLink({
  item,
  channelSlug,
  pathname,
}: {
  item: SidebarItem;
  channelSlug: string | null;
  pathname: string;
}) {
  const Icon = item.icon;
  const active = item.active(pathname);

  return (
    <Link
      href={item.href(channelSlug)}
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

function WorkspaceChannelSwitcher({
  workspaceName,
  channels,
  activeChannelSlug,
}: {
  workspaceName: string;
  channels: ChannelSummary[];
  activeChannelSlug: string | null;
}) {
  const activeChannel =
    channels.find((channel) => channel.slug === activeChannelSlug) ?? null;
  const channelCountLabel = `${channels.length} channel${channels.length === 1 ? "" : "s"}`;
  const meta = activeChannel
    ? `${activeChannel.channelName} selected · ${channelCountLabel}`
    : channelCountLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left shadow-[0_1px_2px_rgb(26_26_24_/_0.04)] transition-colors hover:bg-secondary"
        >
          <ChannelAvatar channelName={workspaceName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-foreground">{workspaceName}</p>
            <p className="truncate text-[12px] text-muted-foreground">{meta}</p>
          </div>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 rounded-[12px] border border-border bg-card p-2 shadow-[0_10px_40px_rgb(26_26_24_/_0.12)]">
        <DropdownMenuLabel className="px-2 pb-2 text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
          Studio Channels
        </DropdownMenuLabel>
        {channels.length ? (
          channels.map((channel) => (
            <DropdownMenuItem asChild key={channel.slug} className="rounded-[10px] px-3 py-2.5">
              <Link href={`/app/channels/${channel.slug}`} className="flex items-center gap-3">
                <ChannelAvatar channelName={channel.channelName} channelSlug={channel.slug} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-foreground">
                    {channel.channelName}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {channel.totalVideos} videos scanned
                  </p>
                </div>
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-3 py-3 text-sm text-muted-foreground">No scanned channels yet.</div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-[10px] px-3 py-2.5">
          <Link href="/app/channels" className="flex items-center gap-3">
            <FolderKanban className="size-4 text-muted-foreground" />
            <span className="text-[14px] font-medium text-foreground">View all channels</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-[10px] px-3 py-2.5">
          <Link href="/app/scans/new" className="flex items-center gap-3">
            <Sparkles className="size-4 text-primary" />
            <span className="text-[14px] font-medium text-foreground">Scan new channel</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({
  pathname,
  workspaceName,
  channels,
  activeChannelSlug,
}: {
  pathname: string;
  workspaceName: string;
  channels: ChannelSummary[];
  activeChannelSlug: string | null;
}) {
  const primaryItems = sidebarItems.filter((item) => !item.bottom);
  const bottomItems = sidebarItems.filter((item) => item.bottom);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="grid shrink-0 gap-5">
        <AppLogo href="/app/channels" size="sm" />
        <WorkspaceChannelSwitcher
          workspaceName={workspaceName}
          channels={channels}
          activeChannelSlug={activeChannelSlug}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="grid gap-1">
          {primaryItems.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              channelSlug={activeChannelSlug}
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
            channelSlug={activeChannelSlug}
            pathname={pathname}
          />
        ))}
      </nav>
    </div>
  );
}

function AccountMenu({
  initials,
  workspaceName,
  userName,
  userEmail,
}: {
  initials: string;
  workspaceName: string;
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
              <p className="text-[12px] text-muted-foreground">{workspaceName}</p>
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
  const params = useParams<Record<string, string | string[] | undefined>>();
  const [rememberedChannelSlug] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LAST_CHANNEL_SLUG_KEY);
  });
  const session = authClient.useSession();
  const me = useBackendQuery<MeResponse>("/me");
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const initials = initialsFromName(session.data?.user.name ?? "YTScan User");
  const items = useMemo(() => channels.data?.items ?? [], [channels.data?.items]);

  useEffect(() => {
    const routeSlug = params.slug;
    if (typeof routeSlug !== "string") return;
    if (!items.some((channel) => channel.slug === routeSlug)) return;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_CHANNEL_SLUG_KEY, routeSlug);
    }
  }, [items, params.slug]);

  const activeChannelSlug = useMemo(
    () => resolvePreferredChannelSlug(pathname, params, items, rememberedChannelSlug),
    [items, params, pathname, rememberedChannelSlug]
  );
  const workspaceName = me.data?.workspace.name ?? "Your Workspace";
  const userName = session.data?.user.name ?? "YTScan User";
  const userEmail = session.data?.user.email ?? "";

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="hidden w-60 shrink-0 border-r border-separator bg-background px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col">
        <SidebarContent
          pathname={pathname}
          workspaceName={workspaceName}
          channels={items}
          activeChannelSlug={activeChannelSlug}
        />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="hidden justify-end border-b border-separator bg-background/95 px-8 py-5 backdrop-blur lg:sticky lg:top-0 lg:z-20 lg:flex xl:px-12">
          <AccountMenu
            initials={initials}
            workspaceName={workspaceName}
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
                workspaceName={workspaceName}
                channels={items}
                activeChannelSlug={activeChannelSlug}
              />
            </SheetContent>
          </Sheet>
          <AppLogo href="/app/channels" size="xs" />
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
