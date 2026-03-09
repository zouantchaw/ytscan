import { NextRequest, NextResponse } from "next/server";
import { getApiOrigin } from "@/lib/server-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");

  if (cookie) {
    headers.set("cookie", cookie);
  }

  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const response = await fetch(new URL("/api/auth/get-session", getApiOrigin()), {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }
  responseHeaders.set("cache-control", "no-store");

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: responseHeaders,
  });
}
