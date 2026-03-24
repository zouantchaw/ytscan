"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import type { ChannelSummary } from "@ytscan/core";
import {
  ChevronDown,
  LayoutGrid,
  Menu,
  Plus,
  Settings,
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

const sidebarItems: SidebarItem[] = [
  {
    key: "channels",
    label: "Channels",
    icon: LayoutGrid,
    href: () => "/app/channels",
    active: (pathname) => pathname.startsWith("/app/channels") || pathname.startsWith("/app/scans"),
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

function resolvePreferredChannelSlug(params: Record<string, string | string[] | undefined>) {
  const routeSlug = params.slug;
  if (typeof routeSlug === "string") return routeSlug;

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

function ChannelLibrarySwitcher({
  channels,
  activeChannelSlug,
}: {
  channels: ChannelSummary[];
  activeChannelSlug: string | null;
}) {
  const activeChannel =
    channels.find((channel) => channel.slug === activeChannelSlug) ?? null;
  const channelCountLabel = `${channels.length} channel${channels.length === 1 ? "" : "s"}`;
  const title = activeChannel?.channelName ?? "Channel Library";
  const meta = activeChannel ? `${channelCountLabel} scanned` : channelCountLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left shadow-[0_1px_2px_rgb(26_26_24_/_0.04)] transition-colors hover:bg-secondary"
        >
          <ChannelAvatar
            channelName={activeChannel?.channelName ?? "Channel Library"}
            channelSlug={activeChannel?.slug ?? null}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-foreground">{title}</p>
            <p className="truncate text-[12px] text-muted-foreground">{meta}</p>
          </div>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 rounded-[12px] border border-border bg-card p-2 shadow-[0_10px_40px_rgb(26_26_24_/_0.12)]">
        <DropdownMenuLabel className="px-2 pb-2 text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
          Scanned Channels
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
            <LayoutGrid className="size-4 text-muted-foreground" />
            <span className="text-[14px] font-medium text-foreground">Open channel library</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-[10px] px-3 py-2.5">
          <Link href="/app/scans/new" className="flex items-center gap-3">
            <Plus className="size-4 text-primary" />
            <span className="text-[14px] font-medium text-foreground">Scan new channel</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({
  pathname,
  channels,
  activeChannelSlug,
}: {
  pathname: string;
  channels: ChannelSummary[];
  activeChannelSlug: string | null;
}) {
  const primaryItems = sidebarItems.filter((item) => !item.bottom);
  const bottomItems = sidebarItems.filter((item) => item.bottom);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="grid shrink-0 gap-5">
        <AppLogo href="/app/channels" size="sm" />
        <ChannelLibrarySwitcher
          channels={channels}
          activeChannelSlug={activeChannelSlug}
        />
        <Button asChild className="justify-start">
          <Link href="/app/scans/new">
            <Plus className="size-4" />
            Scan Channel
          </Link>
        </Button>
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
  const params = useParams<Record<string, string | string[] | undefined>>();
  const session = authClient.useSession();
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const initials = initialsFromName(session.data?.user.name ?? "YTScan User");
  const items = useMemo(() => channels.data?.items ?? [], [channels.data?.items]);

  const activeChannelSlug = useMemo(
    () => resolvePreferredChannelSlug(params),
    [params]
  );
  const userName = session.data?.user.name ?? "YTScan User";
  const userEmail = session.data?.user.email ?? "";

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="hidden w-60 shrink-0 border-r border-separator bg-background px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col">
        <SidebarContent
          pathname={pathname}
          channels={items}
          activeChannelSlug={activeChannelSlug}
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
