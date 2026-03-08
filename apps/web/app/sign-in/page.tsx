import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen bg-background md:grid-cols-[560px_1fr]">
      <AuthBrandPanel
        title={"Scan any channel.\nKnow what works.\nCreate what's next."}
        description="YouTube content intelligence for creators and teams who want data-driven decisions, not gut feelings."
      />
      <section className="flex items-center justify-center px-6 py-14 md:px-12">
        <MagicLinkForm mode="sign-in" />
      </section>
    </main>
  );
}
