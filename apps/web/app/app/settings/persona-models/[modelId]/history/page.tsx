import { redirect } from "next/navigation";

export default async function LegacyPersonaModelHistorySettingsPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  await params;
  redirect("/app/channels");
}
