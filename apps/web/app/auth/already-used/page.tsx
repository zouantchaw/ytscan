import { AuthStateShell } from "@/components/auth/auth-state-shell";

export default function AlreadyUsedLinkPage() {
  return (
    <AuthStateShell
      eyebrow="Magic Link"
      title="This link was already used"
      description="Magic links are one-time use. Request another link if you still need to sign in."
      tone="warning"
      primaryAction={{ href: "/sign-in", label: "Send a new link" }}
      secondaryAction={{ href: "/", label: "Back to home", variant: "outline" }}
    />
  );
}
