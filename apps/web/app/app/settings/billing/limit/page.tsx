import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingLimitPage() {
  return (
    <section className="max-w-[760px] space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-[32px] font-semibold tracking-[-0.04em] text-foreground">
          Plan Limit Reached
        </h2>
        <p className="text-[15px] leading-7 text-muted-foreground">
          This workspace has used the included quota for its current plan.
        </p>
      </div>

      <div className="rounded-[20px] border border-border bg-card px-7 py-8 shadow-[0_1px_2px_rgb(26_26_24_/_0.04)]">
        <div className="flex size-14 items-center justify-center rounded-[18px] bg-[rgb(227_167_57_/_0.14)] text-[#a8741b] ring-1 ring-[rgb(227_167_57_/_0.18)]">
          <CircleAlert className="size-6" />
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="font-display text-[30px] font-semibold tracking-[-0.04em] text-foreground">
            Upgrade to keep shipping
          </h3>
          <p className="text-[15px] leading-7 text-muted-foreground">
            Upgrade your workspace to unlock more channel scans, more generation jobs, and full team workflows without interrupting current projects.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/pricing">Upgrade plan</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/app/settings/billing">Back to billing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
