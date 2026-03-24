import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen bg-background md:grid-cols-[560px_1fr]">
      <AuthBrandPanel
        title={"Import any channel.\nSee the full archive.\nFind what matters."}
        description="Sign in to scan a YouTube channel, pull its historical data, and inspect the archive through one clean dashboard."
      />
      <section className="flex items-center justify-center px-6 py-14 md:px-12">
        <MagicLinkForm mode="sign-in" />
      </section>
    </main>
  );
}
