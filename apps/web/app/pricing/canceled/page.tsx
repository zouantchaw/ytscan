import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";

export default function PricingCanceledPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center px-6 md:px-10 xl:px-12">
        <AppLogo size="xs" />
      </header>

      <section className="flex min-h-[calc(100vh-72px)] items-center justify-center px-6 py-12 md:px-10">
        <div className="w-full max-w-[540px] rounded-[22px] border border-border bg-card px-8 py-9 text-center shadow-[0_1px_2px_rgb(26_26_24_/_0.04)]">
          <div className="mx-auto flex size-16 items-center justify-center rounded-[20px] bg-secondary text-foreground ring-1 ring-border">
            <CircleAlert className="size-7" />
          </div>
          <div className="mt-6 space-y-3">
            <h1 className="font-display text-[38px] font-semibold tracking-[-0.04em] text-foreground">
              Upgrade canceled
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground">
              Your plan did not change. You can try again whenever you are ready, or continue using the features already available in your workspace.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/pricing">Try again</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/app/channels">Back to app</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
