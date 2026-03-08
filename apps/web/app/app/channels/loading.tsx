import { AppTopNav } from "@/components/app/app-top-nav";
import { PageLoading } from "@/components/app/app-ui";

export default function ChannelsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <AppTopNav />
      <main className="app-page py-10">
        <PageLoading />
      </main>
    </div>
  );
}
