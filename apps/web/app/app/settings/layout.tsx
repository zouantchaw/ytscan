import type { ReactNode } from "react";
import { SettingsNav } from "@/components/app/settings-nav";

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
            Settings
          </h1>
          <SettingsNav />
        </header>
        {children}
      </div>
    </main>
  );
}
