"use client";

import type { ChannelSummary, MeResponse } from "@ytscan/core";
import { AppPanel, ErrorState } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackendQuery } from "@/lib/backend-client";

type ChannelCollectionResponse = {
  items: ChannelSummary[];
  count: number;
};

export default function SettingsWorkspacePage() {
  const me = useBackendQuery<MeResponse>("/me");
  const channels = useBackendQuery<ChannelCollectionResponse>("/channels");
  const workspace = me.data?.workspace;

  if (me.error || channels.error) {
    return (
      <section className="max-w-[640px]">
        <ErrorState
          title="Workspace settings are unavailable"
          description="We couldn't load your workspace details. Retry the page and try again."
          action={
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => me.refetch()}>
                Retry workspace
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

  return (
    <section className="max-w-[640px] space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-[32px] font-semibold tracking-[-0.04em] text-foreground">
          Workspace
        </h2>
        <p className="text-[15px] leading-7 text-muted-foreground">
          Manage your shared workspace settings, naming, and default channel context.
        </p>
      </div>

      <div className="space-y-5">
        <label className="grid gap-2">
          <span className="text-[15px] font-medium text-foreground">Workspace name</span>
          <Input value={workspace?.name ?? ""} readOnly />
        </label>
        <label className="grid gap-2">
          <span className="text-[15px] font-medium text-foreground">Workspace slug</span>
          <Input value={workspace?.slug ?? ""} readOnly />
        </label>
      </div>

      <AppPanel className="grid gap-5 px-6 py-5 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Role</p>
          <p className="text-[18px] font-semibold text-foreground">{workspace?.role ?? "Owner"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Channels</p>
          <p className="text-[18px] font-semibold text-foreground">{channels.data?.count ?? 0}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Created</p>
          <p className="text-[18px] font-semibold text-foreground">
            {workspace?.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : "—"}
          </p>
        </div>
      </AppPanel>

      <div className="border-t border-separator" />

      <div className="flex items-center gap-3">
        <Button variant="outline" disabled>
          Rename workspace
        </Button>
        <p className="text-[13px] text-muted-foreground">
          Workspace administration is enabled for owners only.
        </p>
      </div>
    </section>
  );
}
