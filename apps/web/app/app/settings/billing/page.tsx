import { AppPanel } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";

export default function SettingsBillingPage() {
  return (
    <section className="max-w-[640px] space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-[32px] font-semibold tracking-[-0.04em] text-foreground">
          Billing
        </h2>
        <p className="text-[15px] leading-7 text-muted-foreground">
          Review internal usage while the product is still running as a private studio.
        </p>
      </div>

      <AppPanel className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[20px] font-semibold text-foreground">Internal Studio</p>
          <p className="text-sm text-muted-foreground">
            Billing is disabled while YTScan is being operated internally and validated with real
            workflows.
          </p>
        </div>
        <Button variant="outline" disabled>
          Billing Disabled
        </Button>
      </AppPanel>

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-[15px] font-medium text-foreground">Usage this period</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <AppPanel className="px-5 py-4">
              <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Scans</p>
              <p className="mt-2 text-[28px] font-semibold text-foreground">2</p>
            </AppPanel>
            <AppPanel className="px-5 py-4">
              <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Media Jobs</p>
              <p className="mt-2 text-[28px] font-semibold text-foreground">5</p>
            </AppPanel>
            <AppPanel className="px-5 py-4">
              <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Persona Runs</p>
              <p className="mt-2 text-[28px] font-semibold text-foreground">1</p>
            </AppPanel>
          </div>
        </div>

        <div className="border-t border-separator" />

        <div className="space-y-2">
          <p className="text-[15px] font-medium text-foreground">Billing status</p>
          <AppPanel className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">No payment processor connected</p>
              <p className="text-[13px] text-muted-foreground">
                Turn this on when YTScan is ready to charge external customers.
              </p>
            </div>
            <Button variant="outline" disabled>
              Not Available
            </Button>
          </AppPanel>
        </div>
      </div>
    </section>
  );
}
