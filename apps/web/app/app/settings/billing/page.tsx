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
          Review your current plan, usage, and payment setup for YTScan.
        </p>
      </div>

      <AppPanel className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[20px] font-semibold text-foreground">Pro Workspace</p>
          <p className="text-sm text-muted-foreground">
            Includes multi-channel research, persona training, and media generation workflows.
          </p>
        </div>
        <Button>Manage Plan</Button>
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
          <p className="text-[15px] font-medium text-foreground">Payment method</p>
          <AppPanel className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Card ending in 4242</p>
              <p className="text-[13px] text-muted-foreground">Update this once Stripe is connected.</p>
            </div>
            <Button variant="outline">Update</Button>
          </AppPanel>
        </div>
      </div>
    </section>
  );
}
