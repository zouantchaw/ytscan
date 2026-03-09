import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";

export default function PricingSuccessPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center px-6 md:px-10 xl:px-12">
        <AppLogo size="xs" />
      </header>

      <section className="flex min-h-[calc(100vh-72px)] items-center justify-center px-6 py-12 md:px-10">
        <div className="w-full max-w-[560px] rounded-[22px] border border-border bg-card px-8 py-9 text-center shadow-[0_1px_2px_rgb(26_26_24_/_0.04)]">
          <div className="mx-auto flex size-16 items-center justify-center rounded-[20px] bg-[rgb(74_155_110_/_0.12)] text-success ring-1 ring-[rgb(74_155_110_/_0.18)]">
            <CheckCircle2 className="size-7" />
          </div>
          <div className="mt-6 space-y-3">
            <h1 className="font-display text-[38px] font-semibold tracking-[-0.04em] text-foreground">
              Upgrade complete
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              Your workspace is now on Pro. Multi-channel compare, Script Lab generation, and persona training are ready to use.
            </p>
          </div>

          <div className="mt-8 rounded-[16px] bg-secondary px-5 py-5 text-left">
            <dl className="space-y-3 text-[14px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium text-foreground">Pro Workspace</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium text-foreground">$29 / month</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Next billing</dt>
                <dd className="font-medium text-foreground">April 9, 2026</dd>
              </div>
            </dl>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/app/channels">Go to Dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/app/settings/billing">View billing</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
