import type { ReactNode } from "react";

export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-8">
        <header className="space-y-4">
          <h1 className="font-display text-[52px] font-semibold tracking-[-0.05em] text-foreground">
            Account
          </h1>
          <p className="max-w-[680px] text-[15px] leading-7 text-muted-foreground">
            Manage your sign-in details and the basic preferences tied to this YTScan account.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}
