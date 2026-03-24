import { redirect } from "next/navigation";

export default async function LegacyPersonaModelDetailSettingsPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  await params;
  redirect("/app/channels");
}
