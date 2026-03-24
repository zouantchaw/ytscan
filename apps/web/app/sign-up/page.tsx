import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

type SignUpPageProps = {
  searchParams: Promise<{ channelUrl?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { channelUrl } = await searchParams;

  return (
    <main className="grid min-h-screen bg-background md:grid-cols-[540px_1fr]">
      <AuthBrandPanel
        title={"Build a cleaner\nYouTube archive."}
        description="Create an account to scan channels, capture the historical record, and stop doing research through the native YouTube UI."
      />
      <section className="flex items-center justify-center px-6 py-14 md:px-12">
        <MagicLinkForm mode="sign-up" defaultChannelUrl={channelUrl} />
      </section>
    </main>
  );
}
