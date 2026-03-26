import Link from "next/link";
import { AppPanel } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";

const importOptions = [
  {
    eyebrow: "Media Upload",
    title: "Upload audio or video for transcription",
    description:
      "Bring in interviews, founder videos, podcasts, webinars, or raw meeting recordings. We will transcribe the file, keep timestamps, and add it to your searchable archive.",
    bullets: [
      "Private workspace storage",
      "Timestamped transcript segments",
      "TXT, SRT, VTT, and JSON exports",
    ],
    href: "/app/archive",
    cta: "Open uploader",
  },
  {
    eyebrow: "YouTube Import",
    title: "Import a full YouTube channel archive",
    description:
      "Paste a public channel URL to ingest historical metadata, transcripts, thumbnails, and performance history. The channel becomes its own dashboard and searchable archive.",
    bullets: [
      "Historical video performance context",
      "Transcript coverage across uploads",
      "Video archive and transcript search",
    ],
    href: "/app/scans/new",
    cta: "Scan channel",
  },
];

export default function ImportPage() {
  return (
    <main className="app-page py-8">
      <section className="max-w-[1104px] space-y-8">
        <div className="space-y-2">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Import
          </p>
          <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
            Bring content into your archive
          </h1>
          <p className="max-w-[760px] text-[15px] leading-7 text-muted-foreground">
            Start by uploading private media for transcription or importing a public YouTube channel archive. Both paths feed the same searchable library.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {importOptions.map((option) => (
            <AppPanel key={option.title} className="grid gap-6 px-7 py-7">
              <div className="space-y-2">
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {option.eyebrow}
                </p>
                <h2 className="font-display text-[32px] font-semibold tracking-[-0.04em] text-foreground">
                  {option.title}
                </h2>
                <p className="text-[15px] leading-7 text-muted-foreground">{option.description}</p>
              </div>

              <ul className="space-y-2 text-[14px] leading-6 text-muted-foreground">
                {option.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-[8px] size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-3">
                <Button asChild size="lg">
                  <Link href={option.href}>{option.cta}</Link>
                </Button>
              </div>
            </AppPanel>
          ))}
        </div>
      </section>
    </main>
  );
}
