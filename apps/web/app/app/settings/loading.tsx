import { AppPanel } from "@/components/app/app-ui";

export default function SettingsLoading() {
  return (
    <main className="app-page flex flex-col gap-10 py-9 lg:flex-row">
      <aside className="grid w-full gap-1 lg:w-[200px] lg:shrink-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <AppPanel key={index} className="h-10" />
        ))}
      </aside>
      <section className="w-full max-w-[640px] space-y-8">
        <AppPanel className="h-[120px]" />
        <AppPanel className="h-[240px]" />
        <AppPanel className="h-[120px]" />
      </section>
    </main>
  );
}
