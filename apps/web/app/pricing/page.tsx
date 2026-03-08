import Link from "next/link";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing", active: true },
  { href: "/#docs", label: "Docs" },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Perfect for exploring a single channel.",
    tone: "light" as const,
    cta: "Get Started Free",
    features: [
      { label: "1 channel scan", enabled: true },
      { label: "Semantic search", enabled: true },
      { label: "Basic dashboard", enabled: true },
      { label: "Thumbnail analysis", enabled: true },
      { label: "Competitor compare", enabled: false },
      { label: "Script Lab", enabled: false },
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For creators serious about growth.",
    tone: "dark" as const,
    badge: "Most Popular",
    cta: "Start Pro Trial",
    features: [
      { label: "10 channel scans", enabled: true },
      { label: "Unlimited search", enabled: true },
      { label: "Competitor compare", enabled: true },
      { label: "Script Lab (5/mo)", enabled: true },
      { label: "Full thumbnail VLM", enabled: true },
      { label: "Priority scanning", enabled: true },
    ],
  },
  {
    name: "Team",
    price: "$79",
    period: "/month",
    description: "For agencies and content teams.",
    tone: "light" as const,
    cta: "Contact Sales",
    features: [
      { label: "Unlimited channels", enabled: true },
      { label: "Everything in Pro", enabled: true },
      { label: "Unlimited Script Lab", enabled: true },
      { label: "5 team members", enabled: true },
      { label: "LoRA fine-tuning", enabled: true },
      { label: "API access", enabled: true },
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex h-[64px] w-full max-w-[1440px] items-center justify-between gap-6 px-6 md:px-10 xl:px-12">
        <AppLogo size="xs" />
        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.active ? "text-[15px] font-semibold text-foreground" : "text-[15px] text-[#6b6b66] hover:text-foreground"}
            >
              {item.label}
            </Link>
          ))}
          <Button asChild variant="dark" size="sm" className="h-10 rounded-[8px] px-5 text-[14px] font-semibold">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-3 px-6 pb-12 pt-12 text-center md:px-10 xl:px-12">
        <h1 className="font-display text-[36px] font-bold leading-[48px] tracking-[-0.03em] text-foreground md:text-[40px]">
          Simple, transparent pricing
        </h1>
        <p className="text-[16px] leading-5 text-[#6b6b66]">
          Start free. Upgrade when you need more channels and deeper insights.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-[1440px] gap-6 px-6 pb-12 md:px-10 xl:grid-cols-3 xl:px-12">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={
              plan.tone === "dark"
                ? "relative flex h-full flex-col gap-6 rounded-[12px] bg-[#1a1a18] px-9 py-9 text-white"
                : "flex h-full flex-col gap-6 rounded-[12px] border border-border bg-card px-9 py-9"
            }
          >
            {plan.badge ? (
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-primary px-3.5 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-white">
                {plan.badge}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className={plan.tone === "dark" ? "text-[13px] font-semibold uppercase tracking-[0.08em] text-[#9b9b96]" : "text-[13px] font-semibold uppercase tracking-[0.08em] text-[#9b9b96]"}>
                {plan.name}
              </p>
              <div className="flex items-end gap-1">
                <span className={plan.tone === "dark" ? "font-display text-[48px] font-bold leading-[58px] text-white" : "font-display text-[48px] font-bold leading-[58px] text-foreground"}>
                  {plan.price}
                </span>
                <span className="pb-2 text-[15px] leading-[18px] text-[#9b9b96]">{plan.period}</span>
              </div>
              <p className={plan.tone === "dark" ? "text-[14px] leading-[18px] text-[#9b9b96]" : "text-[14px] leading-[18px] text-[#6b6b66]"}>
                {plan.description}
              </p>
            </div>

            <div className={plan.tone === "dark" ? "h-px bg-[#333330]" : "h-px bg-border"} />

            <ul className="space-y-3.5">
              {plan.features.map((feature) => (
                <li key={feature.label} className="flex items-center gap-2.5 text-[14px]">
                  <span className={feature.enabled ? "text-success" : "text-[#9b9b96]"}>
                    {feature.enabled ? "✓" : "—"}
                  </span>
                  <span
                    className={
                      feature.enabled
                        ? plan.tone === "dark"
                          ? "text-white"
                          : "text-foreground"
                        : "text-[#9b9b96]"
                    }
                  >
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              variant={plan.tone === "dark" ? "default" : "outline"}
              className={
                plan.tone === "dark"
                  ? "mt-auto h-11 rounded-[8px] text-[14px] font-semibold"
                  : "mt-auto h-11 rounded-[8px] text-[14px] font-semibold"
              }
            >
              <Link href={plan.name === "Team" ? "/sign-up" : "/sign-up"}>{plan.cta}</Link>
            </Button>
          </article>
        ))}
      </section>
    </main>
  );
}
