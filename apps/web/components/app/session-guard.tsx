"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AppLogo } from "@/components/brand/app-logo";

const SESSION_MARKER_KEY = "ytscan:had-session";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = authClient.useSession();

  useEffect(() => {
    if (session.isPending) return;
    if (typeof window !== "undefined") {
      if (session.data?.user) {
        window.sessionStorage.setItem(SESSION_MARKER_KEY, "1");
        return;
      }

      const hadSession = window.sessionStorage.getItem(SESSION_MARKER_KEY) === "1";
      router.replace(
        hadSession
          ? `/auth/session-expired?next=${encodeURIComponent(pathname || "/app")}`
          : `/sign-in?next=${encodeURIComponent(pathname || "/app")}`
      );
      return;
    }

    if (!session.data?.user) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname || "/app")}`);
    }
  }, [pathname, router, session.data, session.isPending]);

  if (session.isPending || !session.data?.user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
        <AppLogo />
        <div className="h-2 w-40 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
