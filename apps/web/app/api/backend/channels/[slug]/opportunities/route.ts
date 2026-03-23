import type { NextRequest } from "next/server";
import { proxyJsonApiPath } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  return proxyJsonApiPath(
    request,
    `/api/channels/${encodeURIComponent(slug)}/opportunities`
  );
}
