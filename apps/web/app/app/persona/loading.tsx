import { AppPanel } from "@/components/app/app-ui";

export default function PersonaLoading() {
  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-8">
        <AppPanel className="h-[84px]" />
        <AppPanel className="h-[148px]" />
        <AppPanel className="h-[148px]" />
      </div>
    </main>
  );
}
