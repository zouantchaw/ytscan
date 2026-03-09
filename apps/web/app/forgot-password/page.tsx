"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const callbackURL =
        typeof window === "undefined"
          ? "/app"
          : new URL("/app", window.location.origin).toString();
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL,
        errorCallbackURL:
          typeof window === "undefined"
            ? "/auth/magic-link-status"
            : new URL("/auth/magic-link-status", window.location.origin).toString(),
      });

      if (result.error) {
        setError(result.error.message ?? "Unable to send the reset link.");
        return;
      }

      router.push(
        `/auth/magic-link-sent?${new URLSearchParams({
          email,
          mode: "sign-in",
        }).toString()}`
      );
    });
  }

  return (
    <main className="grid min-h-screen bg-background md:grid-cols-[540px_1fr]">
      <AuthBrandPanel
        title={"Reset your password."}
        description="We’ll send you a link to get back into your account."
      />
      <section className="flex items-center justify-center px-6 py-14 md:px-12">
        <div className="w-full max-w-[380px] space-y-7">
          <div className="space-y-2">
            <h1 className="font-display text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground">
              Forgot password?
            </h1>
            <p className="text-[14px] leading-5 text-[#6b6b66]">
              Enter your email and we&apos;ll send a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="grid gap-2">
              <span className="text-[14px] font-medium text-foreground">Email</span>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-11 rounded-[8px] border-border px-4 text-[14px]"
              />
            </label>

            <Button type="submit" className="h-11 w-full rounded-[8px] text-[14px] font-semibold" disabled={isPending}>
              {isPending ? "Sending..." : "Send Reset Link"}
            </Button>

            {error ? (
              <div className="rounded-[10px] border border-[rgb(201_53_41_/_0.22)] bg-[rgb(201_53_41_/_0.08)] px-4 py-3 text-sm leading-6 text-destructive">
                {error}
              </div>
            ) : null}
          </form>

          <p className="text-[14px] text-[#6b6b66]">
            Remember your password?{" "}
            <Link href="/sign-in" className="font-medium text-primary hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
