import { AppPanel } from "@/components/app/app-ui";

export default function TranscribeLoading() {
  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <AppPanel className="h-[220px]" />
        <AppPanel className="h-[520px]" />
      </div>
    </main>
  );
}
