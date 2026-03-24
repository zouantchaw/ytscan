import type { NextRequest } from "next/server";
import { fetchJsonApiPayload } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ projectId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  const { payload, status } = await fetchJsonApiPayload(
    request,
    `/api/script-lab/projects/${encodeURIComponent(projectId)}/generate`
  );

  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
