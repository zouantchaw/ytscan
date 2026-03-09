import { AuthStateShell } from "@/components/auth/auth-state-shell";

type MagicLinkSentPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MagicLinkSentPage({
  searchParams,
}: MagicLinkSentPageProps) {
  const params = (await searchParams) ?? {};
  const email =
    typeof params.email === "string" && params.email.trim().length > 0
      ? params.email.trim()
      : null;
  const mode = params.mode === "sign-up" ? "sign-up" : "sign-in";
  const channel =
    typeof params.channel === "string" && params.channel.trim().length > 0
      ? params.channel.trim()
      : null;

  return (
    <AuthStateShell
      eyebrow="Magic Link"
      title="Check your inbox"
      description={
        mode === "sign-up"
          ? "We sent a sign-in link so you can finish creating your YTScan workspace."
          : "We sent a sign-in link so you can get back into YTScan."
      }
      detail={
        email
          ? mode === "sign-up" && channel
            ? `Sent to ${email}. After sign-in, we'll keep ${channel} ready as your first scan.`
            : `Sent to ${email}. Open the email and finish signing in from the same browser.`
          : undefined
      }
      tone="success"
      primaryAction={{ href: "/sign-in", label: "Back to sign in" }}
      secondaryAction={{ href: "/", label: "Back to home", variant: "outline" }}
    />
  );
}
