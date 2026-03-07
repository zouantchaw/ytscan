import type { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/proxy";

type RouteParams = {
  params: Promise<{ path: string[] }>;
};

export const dynamic = "force-dynamic";

async function handleRequest(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyApiRequest(request, path, "auth");
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;
