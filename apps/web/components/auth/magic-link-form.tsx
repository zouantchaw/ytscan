"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Github, Mail, Send } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MagicLinkFormProps = {
  defaultChannelUrl?: string;
  mode: "sign-in" | "sign-up";
};

function toAbsolutePath(pathname: string) {
  if (typeof window === "undefined") {
    return pathname;
  }

  return new URL(pathname, window.location.origin).toString();
}

export function MagicLinkForm({
  defaultChannelUrl = "",
  mode,
}: MagicLinkFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [channelUrl, setChannelUrl] = useState(defaultChannelUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submitLabel =
    mode === "sign-up" ? "Create Account" : "Email me a sign-in link";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      if (mode === "sign-up" && typeof window !== "undefined") {
        window.localStorage.setItem("ytscan:first-channel-url", channelUrl.trim());
      }

      const callbackURL = toAbsolutePath("/app");
      const errorCallbackURL = toAbsolutePath("/auth/magic-link-status");
      const payload =
        mode === "sign-up"
          ? {
              email,
              name,
              callbackURL,
              errorCallbackURL,
              newUserCallbackURL: callbackURL,
            }
          : {
              email,
              callbackURL,
              errorCallbackURL,
            };

      const result = await authClient.signIn.magicLink(payload);

      if (result.error) {
        setError(result.error.message ?? "Unable to send the magic link.");
        return;
      }

      const params = new URLSearchParams({
        email,
        mode,
      });
      if (mode === "sign-up" && channelUrl.trim()) {
        params.set("channel", channelUrl.trim());
      }
      router.push(`/auth/magic-link-sent?${params.toString()}`);
    });
  }

  return (
    <div className="w-full max-w-[380px] space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground">
          {mode === "sign-up" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-[15px] leading-[20px] text-[#6b6b66]">
          {mode === "sign-up"
            ? "Your first channel scan is free. No credit card required."
            : "Sign in to your account to continue."}
        </p>
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 w-full justify-center rounded-[10px] border-[#e8e6e1] text-[14px] font-medium"
          disabled
        >
          <span className="text-base font-semibold">G</span>
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 w-full justify-center rounded-[10px] border-[#e8e6e1] text-[14px] font-medium"
          disabled
        >
          <Github className="size-4" />
          Continue with GitHub
        </Button>
      </div>

      <div className="flex items-center gap-4 text-sm text-[#9b9b96]">
        <div className="h-px flex-1 bg-separator" />
        <span>or</span>
        <div className="h-px flex-1 bg-separator" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "sign-up" ? (
          <label className="block space-y-2">
            <span className="text-[13px] font-medium text-foreground">Full name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Creator"
              autoComplete="name"
              required
              className="h-11 rounded-[10px] border-[#e8e6e1] px-4 text-[14px]"
            />
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-[13px] font-medium text-foreground">Email</span>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="h-11 rounded-[10px] border-[#e8e6e1] px-4 text-[14px]"
          />
        </label>

        {mode === "sign-up" ? (
          <label className="block space-y-2">
            <span className="text-[13px] font-medium text-foreground">First channel</span>
            <Input
              value={channelUrl}
              onChange={(event) => setChannelUrl(event.target.value)}
              placeholder="https://www.youtube.com/@codie_sanchez"
              type="url"
              className="h-11 rounded-[10px] border-[#e8e6e1] px-4 text-[14px]"
            />
          </label>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full justify-center rounded-[10px] px-4 text-[14px] font-semibold"
          disabled={isPending}
        >
          {isPending ? "Sending link..." : submitLabel}
          <Send className="size-4" />
        </Button>

        {error ? (
          <div className="rounded-[10px] border border-[rgb(201_53_41_/_0.22)] bg-[rgb(201_53_41_/_0.08)] px-4 py-3 text-sm leading-6 text-destructive">
            {error}
          </div>
        ) : null}
      </form>

      <div className="flex items-center gap-2 text-[13px] text-[#6b6b66]">
        <Mail className="size-4" />
        <span>
          {mode === "sign-up" ? "Already have an account?" : "Need an account?"}
        </span>
        <Link
          href={mode === "sign-up" ? "/sign-in" : `/sign-up${defaultChannelUrl ? `?channelUrl=${encodeURIComponent(defaultChannelUrl)}` : ""}`}
          className="font-medium text-primary hover:text-primary/80"
        >
          {mode === "sign-up" ? "Sign in" : "Sign up for free"}
        </Link>
      </div>

      {mode === "sign-in" ? (
        <div className="text-[13px] text-[#6b6b66]">
          <Link href="/forgot-password" className="font-medium text-primary hover:text-primary/80">
            Need a new magic link?
          </Link>
        </div>
      ) : null}
    </div>
  );
}
