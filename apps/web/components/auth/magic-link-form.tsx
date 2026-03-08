"use client";

import Link from "next/link";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [channelUrl, setChannelUrl] = useState(defaultChannelUrl);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submitLabel =
    mode === "sign-up" ? "Create Account" : "Email me a sign-in link";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      if (mode === "sign-up" && typeof window !== "undefined") {
        window.localStorage.setItem("ytscan:first-channel-url", channelUrl.trim());
      }

      const callbackURL = toAbsolutePath("/app");
      const payload =
        mode === "sign-up"
          ? {
              email,
              name,
              callbackURL,
              newUserCallbackURL: callbackURL,
            }
          : {
              email,
              callbackURL,
            };

      const result = await authClient.signIn.magicLink(payload);

      if (result.error) {
        setError(result.error.message ?? "Unable to send the magic link.");
        return;
      }

      setSuccess(
        mode === "sign-up"
          ? `Magic link sent. We’ll use ${channelUrl || "your first channel"} once you’re in.`
          : "Magic link sent. Check your inbox to finish signing in."
      );
    });
  }

  return (
    <div className="w-full max-w-[380px] space-y-8">
      <div className="space-y-2">
        <h2 className="text-[34px] font-bold leading-none tracking-[-0.04em]">
          {mode === "sign-up" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-[15px] leading-7 text-muted-foreground">
          {mode === "sign-up"
            ? "Your first channel scan is free. No credit card required."
            : "Sign in to your account to continue."}
        </p>
      </div>

      <div className="space-y-3">
        <Button type="button" variant="outline" size="lg" className="w-full justify-center" disabled>
          <span className="text-base font-semibold">G</span>
          Continue with Google
        </Button>
        <Button type="button" variant="outline" size="lg" className="w-full justify-center" disabled>
          <Github className="size-4" />
          Continue with GitHub
        </Button>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="h-px flex-1 bg-separator" />
        <span>or</span>
        <div className="h-px flex-1 bg-separator" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === "sign-up" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Full name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Creator"
              autoComplete="name"
              required
            />
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Email</span>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        {mode === "sign-up" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">First channel</span>
            <Input
              value={channelUrl}
              onChange={(event) => setChannelUrl(event.target.value)}
              placeholder="https://www.youtube.com/@codie_sanchez"
              type="url"
            />
          </label>
        ) : null}

        <Button type="submit" size="lg" className="w-full justify-center" disabled={isPending}>
          {isPending ? "Sending link..." : submitLabel}
          <Send className="size-4" />
        </Button>

        {success ? (
          <div className="rounded-[10px] border border-[rgb(74_155_110_/_0.28)] bg-[rgb(74_155_110_/_0.08)] px-4 py-3 text-sm leading-6 text-success">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[10px] border border-[rgb(201_53_41_/_0.22)] bg-[rgb(201_53_41_/_0.08)] px-4 py-3 text-sm leading-6 text-destructive">
            {error}
          </div>
        ) : null}
      </form>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="size-4" />
        <span>
          {mode === "sign-up" ? "Already have an account?" : "Need an account?"}
        </span>
        <Link
          href={mode === "sign-up" ? "/sign-in" : `/sign-up${defaultChannelUrl ? `?channelUrl=${encodeURIComponent(defaultChannelUrl)}` : ""}`}
          className="font-medium text-foreground hover:text-primary"
        >
          {mode === "sign-up" ? "Sign in" : "Sign up for free"}
        </Link>
      </div>
    </div>
  );
}
