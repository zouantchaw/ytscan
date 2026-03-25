import type { NextRequest } from "next/server";
import { proxyApiPath } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ mediaId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { mediaId } = await params;
  return proxyApiPath(request, `/api/media/${encodeURIComponent(mediaId)}/file`);
}
