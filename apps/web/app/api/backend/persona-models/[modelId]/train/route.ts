import type { NextRequest } from "next/server";
import { proxyApiPath } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ modelId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { modelId } = await params;
  return proxyApiPath(
    request,
    `/api/persona-models/${encodeURIComponent(modelId)}/train`
  );
}
