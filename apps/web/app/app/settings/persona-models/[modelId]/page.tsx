import { redirect } from "next/navigation";

export default async function LegacyPersonaModelDetailSettingsPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  redirect(`/app/persona/${modelId}`);
}
