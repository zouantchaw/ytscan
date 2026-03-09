import { AuthStateShell } from "@/components/auth/auth-state-shell";

export default function InvalidLinkPage() {
  return (
    <AuthStateShell
      eyebrow="Magic Link"
      title="This link is invalid"
      description="The sign-in link could not be verified. It may be malformed or missing required information."
      tone="error"
      primaryAction={{ href: "/sign-in", label: "Request a new link" }}
      secondaryAction={{ href: "/", label: "Back to home", variant: "outline" }}
    />
  );
}
