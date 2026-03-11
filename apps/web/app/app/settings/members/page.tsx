"use client";

import type { MeResponse } from "@ytscan/core";
import { AppPanel, ErrorState } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { useBackendQuery } from "@/lib/backend-client";

export default function SettingsMembersPage() {
  const me = useBackendQuery<MeResponse>("/me");

  if (me.error) {
    return (
      <section className="max-w-[640px]">
        <ErrorState
          title="Members are unavailable"
          description="We couldn't load the workspace member information. Retry the page and try again."
          action={<Button variant="outline" onClick={() => me.refetch()}>Retry</Button>}
        />
      </section>
    );
  }

  return (
    <section className="max-w-[640px] space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-[32px] font-semibold tracking-[-0.04em] text-foreground">
          Access
        </h2>
        <p className="text-[15px] leading-7 text-muted-foreground">
          Manage the operators who can access the shared YTScan studio.
        </p>
      </div>

      <AppPanel className="space-y-4 px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[16px] font-semibold text-foreground">{me.data?.user.name ?? "Workspace owner"}</p>
            <p className="text-sm text-muted-foreground">{me.data?.user.email ?? "Loading email..."}</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[12px] font-medium text-foreground">
            {me.data?.workspace.role ?? "Owner"}
          </span>
        </div>
        <div className="border-t border-separator" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-medium text-foreground">Invitations</p>
            <p className="text-[13px] text-muted-foreground">
              New teammates are attached to the shared studio when access is granted. Invite flows
              can be added here later without changing the rest of the app.
            </p>
          </div>
          <Button variant="outline" disabled>
            Manage access
          </Button>
        </div>
      </AppPanel>
    </section>
  );
}
