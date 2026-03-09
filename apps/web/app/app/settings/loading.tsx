import { AppPanel } from "@/components/app/app-ui";

export default function SettingsLoading() {
  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-8">
        <div className="space-y-4">
          <AppPanel className="h-14 w-52" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <AppPanel key={index} className="h-10 w-28" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <AppPanel className="h-[120px] max-w-[640px]" />
          <AppPanel className="h-[240px] max-w-[640px]" />
          <AppPanel className="h-[120px] max-w-[640px]" />
        </div>
      </div>
    </main>
  );
}
