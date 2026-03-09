import { AuthStateShell } from "@/components/auth/auth-state-shell";

export default function ExpiredLinkPage() {
  return (
    <AuthStateShell
      eyebrow="Magic Link"
      title="This link has expired"
      description="Magic links only stay valid for a short time. Request a fresh one and try again."
      tone="warning"
      primaryAction={{ href: "/sign-in", label: "Send a new link" }}
      secondaryAction={{ href: "/", label: "Back to home", variant: "outline" }}
    />
  );
}
