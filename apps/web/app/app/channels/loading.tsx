import { PageLoading } from "@/components/app/app-ui";

export default function ChannelsLoading() {
  return (
    <main className="app-page pb-10 pt-4 lg:pt-0">
      <div className="max-w-[1104px] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-14 w-64 rounded-[12px] bg-secondary" />
            <div className="h-6 w-80 rounded-[10px] bg-secondary" />
          </div>
          <div className="hidden h-11 w-44 rounded-[12px] bg-secondary lg:block" />
        </div>
        <PageLoading cards={2} className="md:grid-cols-2 xl:grid-cols-2" />
      </div>
    </main>
  );
}
