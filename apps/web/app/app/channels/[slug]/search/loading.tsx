import { AppPanel } from "@/components/app/app-ui";

export default function SearchLoading() {
  return (
    <main className="app-page py-8">
      <div className="grid gap-6">
        <AppPanel className="h-[120px]" />
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <AppPanel key={index} className="h-[170px]" />
          ))}
        </div>
      </div>
    </main>
  );
}
