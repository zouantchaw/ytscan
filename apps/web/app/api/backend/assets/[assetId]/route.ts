import type { NextRequest } from "next/server";
import { proxyApiPath } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ assetId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { assetId } = await params;
  return proxyApiPath(request, `/api/assets/${encodeURIComponent(assetId)}`);
}
