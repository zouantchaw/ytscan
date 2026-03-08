import { AppPanel } from "@/components/app/app-ui";

export default function ChannelLoading() {
  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <AppPanel className="h-[108px]" />
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <AppPanel key={index} className="h-[120px]" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <AppPanel className="h-[540px]" />
          <AppPanel className="h-[540px]" />
        </div>
      </div>
    </main>
  );
}
