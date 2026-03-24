"use client";

import Link from "next/link";
import type { ChannelDashboard } from "@ytscan/core";
import { useParams, usePathname } from "next/navigation";
import { useBackendQuery } from "@/lib/backend-client";
import { prettifyChannelSlug } from "@/lib/channel-ui";

type ChannelLayoutProps = {
  children: React.ReactNode;
};

export default function ChannelLayout({ children }: ChannelLayoutProps) {
  const params = useParams<{ slug: string }>();
  const pathname = usePathname();
  const slug = params.slug;
  const isVideoDetailRoute =
    (pathname?.includes("/videos/") ?? false) && !(pathname?.endsWith("/videos") ?? false);
  const channel = useBackendQuery<ChannelDashboard>(`/channels/${encodeURIComponent(slug)}`);
  const channelName = channel.data?.channelName ?? prettifyChannelSlug(slug);
  const tabs = [
    { href: `/app/channels/${slug}`, label: "Dashboard" },
    { href: `/app/channels/${slug}/videos`, label: "Video Archive" },
    { href: `/app/channels/${slug}/search`, label: "Transcript Search" },
  ];

  const isTabActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href.endsWith("/videos") && pathname.startsWith(`${href}/`)) return true;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <div className="space-y-5">
      <div className="app-page">
        <div className="space-y-4">
          {isVideoDetailRoute ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <Link
                href={`/app/channels/${slug}`}
                className="font-medium text-foreground hover:text-primary"
              >
                {channelName}
              </Link>
              <span>/</span>
              <span>Video Archive</span>
              <span>/</span>
              <span className="font-medium text-foreground">Video Detail</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  isTabActive(tab.href)
                    ? "rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-medium text-white"
                    : "rounded-[8px] bg-secondary px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                }
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
