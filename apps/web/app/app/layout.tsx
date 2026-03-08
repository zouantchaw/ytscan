import { SessionGuard } from "@/components/app/session-guard";

export default function AuthenticatedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SessionGuard>{children}</SessionGuard>;
}
