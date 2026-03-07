import Link from "next/link";
import { ArrowRight, LayoutDashboard, Search, WandSparkles } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const nextSteps = [
  {
    icon: LayoutDashboard,
    title: "Channel Dashboard",
    description: "Compare Codie and Johnny against the real backend metrics you already seeded.",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description: "Run transcript queries, inspect hooks, and validate the search UI on real corpus data.",
  },
  {
    icon: WandSparkles,
    title: "Script Lab",
    description: "Move from topic research to generated hooks, outlines, and script drafts in one stateful flow.",
  },
];

export default function AppHomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container-page py-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-4">
              <AppLogo />
              <Badge variant="accent">Frontend in progress</Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-[-0.04em] md:text-6xl">
                  The product shell is live.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                  Landing and auth are wired. Dashboard, search, and Script Lab screens are the next frontend slice against the existing Cloudflare backend.
                </p>
              </div>
            </div>
            <Button asChild size="lg">
              <Link href="/">
                Back to landing
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {nextSteps.map((step) => (
              <Card key={step.title}>
                <CardHeader>
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-[10px] bg-accent text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  This route exists so magic-link callback targets resolve locally while the rest of the app is still being implemented.
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
