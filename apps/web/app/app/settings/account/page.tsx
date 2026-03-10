"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ChannelSummary, MeResponse } from "@ytscan/core";
import { ChannelAvatar, ErrorState } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useBackendQuery } from "@/lib/backend-client";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

export default function SettingsAccountPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const me = useBackendQuery<MeResponse>("/me");
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");

  if (me.error || channels.error) {
    return (
      <section className="max-w-[640px]">
        <ErrorState
          title="Account settings are unavailable"
          description="We couldn't load your account details. Retry the page and try again."
          action={
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => me.refetch()}>
                Retry account
              </Button>
              <Button variant="outline" onClick={() => channels.refetch()}>
                Retry channels
              </Button>
            </div>
          }
        />
      </section>
    );
  }

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/");
    });
  }

  return (
    <section className="max-w-[560px] space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-[32px] font-semibold tracking-[-0.04em] text-foreground">
          Profile
        </h2>
        <p className="text-[15px] leading-7 text-muted-foreground">
          Manage your account information and preferences.
        </p>
      </div>

      <div className="flex items-center gap-5">
        <ChannelAvatar
          channelName={me.data?.user.name ?? "YTScan User"}
          channelSlug={channels.data?.items[0]?.slug}
          size="lg"
        />
        <div className="space-y-1">
          <p className="text-[18px] font-semibold text-foreground">{me.data?.user.name ?? "YTScan User"}</p>
          <p className="text-sm text-muted-foreground">{me.data?.user.email ?? "Loading email..."}</p>
        </div>
      </div>

      <div className="space-y-5">
        <label className="grid gap-2">
          <span className="text-[15px] font-medium text-foreground">Display name</span>
          <Input value={me.data?.user.name ?? ""} readOnly />
        </label>
        <label className="grid gap-2">
          <span className="text-[15px] font-medium text-foreground">Email</span>
          <Input value={me.data?.user.email ?? ""} readOnly />
          <span className="text-[13px] text-muted-foreground">
            Contact support to change your email address.
          </span>
        </label>
      </div>

      <div className="border-t border-separator" />

      <div className="space-y-3">
        <p className="text-[15px] font-medium text-foreground">Danger zone</p>
        <Button variant="destructive" onClick={handleSignOut} disabled={isPending}>
          {isPending ? "Signing out..." : "Sign out"}
        </Button>
      </div>
    </section>
  );
}
