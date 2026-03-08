import { AppPanel } from "@/components/app/app-ui";

export default function ScriptLabProjectLoading() {
  return (
    <main className="flex min-h-[calc(100vh-69px)]">
      <div className="hidden w-[280px] shrink-0 border-r border-separator lg:block" />
      <section className="flex-1 px-6 py-9 md:px-10 xl:px-12">
        <div className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-6">
            <AppPanel className="h-[90px]" />
            <AppPanel className="h-[420px]" />
          </div>
          <div className="grid gap-5">
            <AppPanel className="h-[170px]" />
            <AppPanel className="h-[170px]" />
            <AppPanel className="h-[140px]" />
          </div>
        </div>
      </section>
    </main>
  );
}
