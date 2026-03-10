import type { NextRequest } from "next/server";
import { proxyJsonApiPath } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ projectId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  return proxyJsonApiPath(
    request,
    `/api/script-lab/projects/${encodeURIComponent(projectId)}`
  );
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  return proxyJsonApiPath(
    request,
    `/api/script-lab/projects/${encodeURIComponent(projectId)}`
  );
}
