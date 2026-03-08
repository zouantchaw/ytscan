import { LandingNav } from "@/components/marketing/landing-nav";
import { ScanChannelForm } from "@/components/marketing/scan-channel-form";
import { SocialProof } from "@/components/marketing/social-proof";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <section className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-[1440px] flex-col items-center justify-center gap-10 px-6 py-12 text-center md:px-10 md:py-16 xl:gap-[40px] xl:px-16">
          <div className="flex max-w-[800px] flex-col items-center gap-5">
            <Badge variant="accent" className="h-auto gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium tracking-[0.02em] text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Now in beta — scan any channel in minutes
            </Badge>
            <div className="space-y-5">
              <h1 className="text-balance text-[44px] font-bold leading-[0.98] tracking-[-0.05em] md:text-[56px] xl:text-[64px] xl:leading-[68px] xl:tracking-[-0.035em]">
                Scan any channel.
                <br />
                Know what works.
              </h1>
              <p className="mx-auto max-w-[540px] text-[17px] leading-8 text-[#6b6b66] md:text-[18px] md:leading-7">
                YouTube content intelligence that ingests every video, surfaces what performs, and helps you create what&apos;s next.
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
