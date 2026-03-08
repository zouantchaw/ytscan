import { AppPanel } from "@/components/app/app-ui";

export default function PersonaModelsLoading() {
  return (
    <main className="app-page py-9">
      <div className="grid gap-8">
        <AppPanel className="h-[92px]" />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <AppPanel key={index} className="h-[118px]" />
          ))}
        </div>
      </div>
    </main>
  );
}
