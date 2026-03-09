import { AuthStateShell } from "@/components/auth/auth-state-shell";

type SessionExpiredPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SessionExpiredPage({
  searchParams,
}: SessionExpiredPageProps) {
  const params = (await searchParams) ?? {};
  const next =
    typeof params.next === "string" && params.next.trim().length > 0
      ? params.next.trim()
      : "/app";

  return (
    <AuthStateShell
      eyebrow="Session"
      title="Your session expired"
      description="Sign in again to keep working on your channels, scripts, and research."
      tone="warning"
      primaryAction={{
        href: `/sign-in?next=${encodeURIComponent(next)}`,
        label: "Sign in again",
      }}
      secondaryAction={{ href: "/", label: "Back to home", variant: "outline" }}
    />
  );
}
