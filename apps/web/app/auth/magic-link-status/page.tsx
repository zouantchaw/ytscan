import { redirect } from "next/navigation";

type MagicLinkStatusPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MagicLinkStatusPage({
  searchParams,
}: MagicLinkStatusPageProps) {
  const params = (await searchParams) ?? {};
  const normalized = [
    firstParam(params.error),
    firstParam(params.code),
    firstParam(params.reason),
    firstParam(params.message),
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (normalized.includes("SESSION_EXPIRED")) {
    redirect("/auth/session-expired");
  }
  if (
    normalized.includes("ALREADY_USED") ||
    normalized.includes("USED") ||
    normalized.includes("CONSUMED")
  ) {
    redirect("/auth/already-used");
  }
  if (normalized.includes("TOKEN_EXPIRED") || normalized.includes("EXPIRED")) {
    redirect("/auth/expired-link");
  }

  redirect("/auth/invalid-link");
}
