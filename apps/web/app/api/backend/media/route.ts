import type { NextRequest } from "next/server";
import { fetchJsonApiPayload } from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export function GET(request: NextRequest) {
  return fetchJson(request, "/api/media");
}

export function POST(request: NextRequest) {
  return fetchJson(request, "/api/media");
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
