import Link from "next/link";
import { ArrowRight, BarChart3, Brain, Sparkles } from "lucide-react";
import { LandingNav } from "@/components/marketing/landing-nav";
import { ScanChannelForm } from "@/components/marketing/scan-channel-form";
import { SocialProof } from "@/components/marketing/social-proof";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const featureCards = [
  {
    icon: Brain,
    title: "Semantic channel memory",
    description:
      "Search every transcript, hook, and thumbnail pattern without scrubbing through the catalog by hand.",
  },
  {
    icon: BarChart3,
    title: "Performance intelligence",
    description:
      "Know the formats, durations, and topics that actually move views, not just what feels memorable.",
  },
  {
    icon: Sparkles,
    title: "Script Lab in context",
    description:
      "Generate hooks, outlines, and creator-voice drafts from the same research corpus you are already analyzing.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-x-0 top-0 -z-10 h-[540px] bg-[radial-gradient(circle_at_top,_rgb(254_242_240)_0%,_rgb(250_250_248)_58%,_rgb(250_250_248)_100%)]" />
      <LandingNav />
      <main>
        <section className="container-page flex min-h-[calc(100vh-86px)] flex-col items-center justify-center gap-10 py-16 text-center md:py-24">
          <div className="flex max-w-[540px] flex-col items-center gap-6">
            <Badge variant="accent" className="gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              Now in beta — scan any channel in minutes
            </Badge>
            <div className="space-y-5">
              <h1 className="text-balance text-5xl font-bold leading-[0.98] tracking-[-0.05em] md:text-[72px]">
                Scan any channel.
                <br />
                Know what works.
                <br />
                Create what&apos;s next.
              </h1>
              <p className="mx-auto max-w-[540px] text-[17px] leading-8 text-muted-foreground md:text-lg">
                YouTube content intelligence that ingests every video, surfaces what actually performs, and helps your team write from evidence instead of guesswork.
              </p>
            </div>
          </div>

          <ScanChannelForm />
          <SocialProof />
        </section>

        <section id="features" className="container-page space-y-8 py-8 md:py-16">
          <div className="max-w-2xl space-y-3">
            <Badge variant="outline">Core Beta Features</Badge>
            <h2 className="text-3xl font-bold md:text-5xl">Research, analysis, and script generation in one loop.</h2>
            <p className="text-base leading-8 text-muted-foreground md:text-lg">
              The first frontend slice is built around the screens you actually need to test: landing, auth, dashboards, and Script Lab against the real Codie and Johnny datasets.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {featureCards.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="mb-5 inline-flex size-11 items-center justify-center rounded-[10px] bg-accent text-primary">
                    <feature.icon className="size-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="container-page py-8 md:py-16">
          <Card className="bg-foreground text-white shadow-[0_24px_80px_rgb(26_26_24_/_0.12)]">
            <CardHeader>
              <Badge className="w-fit bg-white/10 text-white">Pricing</Badge>
              <CardTitle className="text-[32px] text-white md:text-[44px]">
                Free while the core workflow is in beta.
              </CardTitle>
              <CardDescription className="max-w-2xl text-white/70">
                Use the real backend, scan channels, test Script Lab flows, and validate the product against the Paper screens before SaaS packaging gets expanded.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-7 text-white/72">
                Includes channel ingestion, transcript search, dashboard metrics, compare views, and Script Lab project scaffolding.
              </div>
              <Button asChild variant="default" size="lg" className="self-start md:self-auto">
                <Link href="/sign-up">
                  Start with the beta
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="docs" className="container-page py-8 pb-16 md:py-16 md:pb-24">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Backend-first, SaaS-ready</CardTitle>
                <CardDescription>
                  Cloudflare handles the application edge, D1, Vectorize, and R2. The frontend can now proxy directly into the real API shape you already deployed.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-[10px] bg-subtle px-4 py-3">
                  `GET /api/channels/:slug` for dashboard data
                </div>
                <div className="rounded-[10px] bg-subtle px-4 py-3">
                  `GET /api/search` for transcript intelligence
                </div>
                <div className="rounded-[10px] bg-subtle px-4 py-3">
                  `POST /api/script-lab/projects` for project creation and generation state
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Seeded with real channels</CardTitle>
                <CardDescription>
                  Codie Sanchez and Johnny Harris are already ingested, which means the frontend can be validated against actual content instead of fixtures.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                <p>Codie: 160 videos, transcript corpus, hooks, thumbnails, and seeded search vectors.</p>
                <p>Johnny: ingested and available for compare flows and topic gap analysis.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
