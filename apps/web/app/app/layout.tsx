import { AuthenticatedAppShell } from "@/components/app/authenticated-app-shell";
import { SessionGuard } from "@/components/app/session-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthenticatedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SessionGuard>
      <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
    </SessionGuard>
  );
}
