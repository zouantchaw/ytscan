import type { NextRequest } from "next/server";
import { fetchJsonApiPayload } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ projectId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  const { payload, status } = await fetchJsonApiPayload(
    request,
    `/api/script-lab/projects/${encodeURIComponent(projectId)}`
  );

  if (
    status >= 200 &&
    status < 300 &&
    (!payload ||
      typeof payload !== "object" ||
      !("project" in payload) ||
      !payload.project ||
      typeof payload.project !== "object")
  ) {
    return Response.json(
      {
        error: `Script project ${projectId} returned an unusable payload.`,
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  const { payload, status } = await fetchJsonApiPayload(
    request,
    `/api/script-lab/projects/${encodeURIComponent(projectId)}`
  );

  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
