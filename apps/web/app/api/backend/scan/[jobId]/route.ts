import { NextRequest } from "next/server";
import { proxyJsonApiPath } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;
  return proxyJsonApiPath(request, `/api/scan/${encodeURIComponent(jobId)}`);
}
