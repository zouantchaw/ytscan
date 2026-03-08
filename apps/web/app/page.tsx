import { LandingNav } from "@/components/marketing/landing-nav";
import { ScanChannelForm } from "@/components/marketing/scan-channel-form";
import { SocialProof } from "@/components/marketing/social-proof";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <section className="container-page flex min-h-[calc(100vh-86px)] flex-col items-center justify-center gap-10 py-12 text-center md:py-20">
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
              </h1>
              <p className="mx-auto max-w-[540px] text-[17px] leading-8 text-muted-foreground md:text-lg">
                YouTube content intelligence that ingests every video, surfaces what actually performs, and helps your team write from evidence instead of guesswork.
              </p>
            </div>
          </div>

          <ScanChannelForm />
          <SocialProof />
        </section>
      </main>
    </div>
  );
}
