import { NextRequest, NextResponse } from "next/server";
import { getApiOrigin } from "@/lib/server-env";

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;
  const headers = new Headers();
  const cookie = request.headers.get("cookie");

  if (cookie) {
    headers.set("cookie", cookie);
  }

  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const response = await fetch(
    new URL(`/api/scan/${encodeURIComponent(jobId)}`, getApiOrigin()),
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  responseHeaders.set("cache-control", "no-store");

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: responseHeaders,
  });
}
