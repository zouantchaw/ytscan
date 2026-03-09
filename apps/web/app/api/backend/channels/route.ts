import type { NextRequest } from "next/server";
import { proxyApiPath } from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export function GET(request: NextRequest) {
  return proxyApiPath(request, "/api/channels");
}
