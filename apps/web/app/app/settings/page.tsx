"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ChannelSummary, MeResponse } from "@ytscan/core";
import { AppTopNav } from "@/components/app/app-top-nav";
import { AppPanel, ChannelAvatar } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useBackendQuery } from "@/lib/backend-client";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

const settingsItems = [
  "Profile",
  "Billing",
  "Team",
  "API Keys",
  "Scan History",
  "Notifications",
];

export default function SettingsPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const me = useBackendQuery<MeResponse>("/me");
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const backHref = channels.data?.items[0]?.slug
    ? `/app/channels/${channels.data.items[0].slug}`
    : "/app/channels";

  async function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/");
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppTopNav backHref={backHref} backLabel="Back to Dashboard" />
      <main className="app-page flex flex-col gap-10 py-9 lg:flex-row">
        <aside className="grid w-full gap-1 text-[15px] text-muted-foreground lg:w-[200px] lg:shrink-0">
          {settingsItems.map((item, index) => (
            <div
              key={item}
              className={`rounded-[8px] px-4 py-2.5 ${index === 0 ? "bg-secondary font-medium text-foreground" : ""}`}
            >
              {item}
            </div>
          ))}
        </aside>

        <section className="w-full max-w-[640px] space-y-8">
          <div className="space-y-2">
            <h1 className="font-display text-[42px] font-semibold tracking-[-0.05em] text-foreground">
              Profile
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              Manage your account information and workspace preferences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <ChannelAvatar
              channelName={me.data?.user.name ?? "YTScan User"}
              channelSlug={channels.data?.items[0]?.slug}
              size="lg"
            />
            <div>
              <p className="text-[18px] font-semibold text-foreground">{me.data?.user.name}</p>
              <p className="text-sm text-muted-foreground">{me.data?.user.email}</p>
            </div>
            <Button variant="outline" size="sm">
              Profile photo
            </Button>
          </div>

          <div className="border-t border-separator" />

          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Full name</span>
              <Input value={me.data?.user.name ?? ""} readOnly />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Email</span>
              <Input value={me.data?.user.email ?? ""} readOnly />
            </label>
          </div>

          <AppPanel className="flex items-center justify-between gap-4 px-5 py-5">
            <div>
              <p className="text-sm font-medium text-foreground">Workspace</p>
              <p className="text-sm text-muted-foreground">
                {me.data?.workspace.name} · {me.data?.workspace.role}
              </p>
            </div>
            <Button variant="outline" size="sm">
              Active
            </Button>
          </AppPanel>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline">
              Save Changes
            </Button>
            <Button variant="outline">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSignOut} disabled={isPending}>
              {isPending ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
