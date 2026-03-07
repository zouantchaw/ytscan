import { NextRequest } from "next/server";
import { getApiOrigin } from "@/lib/server-env";

function buildTargetUrl(
  request: NextRequest,
  path: string[],
  namespace: "auth" | "backend"
) {
  const target = new URL(
    `/api/${namespace}/${path.join("/")}`,
    getApiOrigin()
  );

  target.search = request.nextUrl.search;
  return target;
}

export async function proxyApiRequest(
  request: NextRequest,
  path: string[],
  namespace: "auth" | "backend"
) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const target = buildTargetUrl(request, path, namespace);
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const response = await fetch(target, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
