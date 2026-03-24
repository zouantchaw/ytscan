import { AppPanel } from "@/components/app/app-ui";

export default function ChannelVideosLoading() {
  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <AppPanel className="h-[144px]" />
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <AppPanel key={index} className="h-[120px]" />
          ))}
        </div>
        <AppPanel className="h-[640px]" />
      </div>
    </main>
  );
}
