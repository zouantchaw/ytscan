import type { NextRequest } from "next/server";
import { fetchJsonApiPayload } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ mediaId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { mediaId } = await params;
  return fetchJson(request, `/api/media/${encodeURIComponent(mediaId)}/translate`);
}

async function fetchJson(request: NextRequest, targetPath: string) {
  const { payload, status } = await fetchJsonApiPayload(request, targetPath);

  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
