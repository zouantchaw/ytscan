"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ChannelSummary } from "@ytscan/core";
import { AppPanel, ChannelAvatar, EmptyState } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { useBackendQuery } from "@/lib/backend-client";
import { cn } from "@/lib/utils";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

export default function ComparePickerPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const currentChannel = channels.data?.items.find((item) => item.slug === slug) ?? null;
  const competitorChannels = (channels.data?.items ?? []).filter((item) => item.slug !== slug);
  const [selectedSlug, setSelectedSlug] = useState<string | null | undefined>(undefined);
  const resolvedSelectedSlug =
    selectedSlug === undefined ? competitorChannels[0]?.slug ?? null : selectedSlug;

  if (!competitorChannels.length) {
    return (
      <main className="app-page pb-10 pt-4 lg:pt-0">
        <EmptyState
          title="No competitor channels yet"
          description="Scan a second channel first, then come back here to compare them side by side."
          actionLabel="+ Scan Channel"
          actionHref="/app/scans/new"
        />
      </main>
    );
  }

  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="mx-auto flex max-w-[760px] flex-col items-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-center font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
            Compare Channels
          </h1>
          <p className="max-w-[620px] text-center text-[15px] leading-7 text-muted-foreground">
            Select two channels to see side-by-side metrics, content gaps, and topic overlap.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6 xl:flex-row xl:justify-start">
        <PickerCard
          title={currentChannel?.channelName ?? "Current channel"}
          subtitle={`${currentChannel?.totalVideos ?? 0} videos`}
          slug={currentChannel?.slug}
          initialsSource={currentChannel?.channelName ?? "YTScan"}
          selected
        />
        <span className="font-display text-[20px] font-bold text-placeholder">VS</span>
        <button type="button" onClick={() => setSelectedSlug(null)}>
          <AppPanel className="flex h-[200px] w-[320px] items-center justify-center border-dashed bg-transparent">
            {resolvedSelectedSlug ? (
              <div className="flex flex-col items-center gap-3">
                <ChannelAvatar
                  channelName={
                    competitorChannels.find((item) => item.slug === resolvedSelectedSlug)?.channelName ?? "Channel"
                  }
                  channelSlug={resolvedSelectedSlug}
                  size="lg"
                />
                <p className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">
                  {competitorChannels.find((item) => item.slug === resolvedSelectedSlug)?.channelName}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-[24px] text-placeholder">
                  +
                </div>
                <p className="text-[14px] font-medium text-muted-foreground">Select a channel</p>
              </div>
            )}
          </AppPanel>
        </button>
        </div>

        <div className="w-full max-w-[480px] space-y-2 text-left">
          <p className="text-[13px] font-medium text-muted-foreground">Your scanned channels:</p>
          {competitorChannels.map((channel) => (
            <button
              key={channel.slug}
              type="button"
              onClick={() => setSelectedSlug(channel.slug)}
              className="block w-full text-left"
            >
              <AppPanel
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  resolvedSelectedSlug === channel.slug && "border-primary"
                )}
              >
                <ChannelAvatar channelName={channel.channelName} channelSlug={channel.slug} />
                <span className="flex-1 text-[14px] font-medium text-foreground">{channel.channelName}</span>
                <span className="text-[12px] text-muted-foreground">{channel.totalVideos} videos</span>
              </AppPanel>
            </button>
          ))}
        </div>

        <Button
          size="lg"
          onClick={() => {
            if (!resolvedSelectedSlug) return;
            router.push(`/app/channels/${slug}/compare?right=${encodeURIComponent(resolvedSelectedSlug)}`);
          }}
          disabled={!resolvedSelectedSlug}
        >
          Compare Channels
        </Button>
      </div>
    </main>
  );
}

function PickerCard({
  title,
  subtitle,
  slug,
  initialsSource,
  selected = false,
}: {
  title: string;
  subtitle: string;
  slug?: string | null;
  initialsSource: string;
  selected?: boolean;
}) {
  return (
    <AppPanel
      className={cn(
        "flex h-[200px] w-[320px] items-center justify-center border border-dashed border-border bg-transparent shadow-none",
        selected && "border-[#E8E6E1]"
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <ChannelAvatar channelName={initialsSource} channelSlug={slug} size="lg" />
        <p className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">{title}</p>
        <p className="text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
    </AppPanel>
  );
}
