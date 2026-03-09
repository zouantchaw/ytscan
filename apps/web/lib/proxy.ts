import { NextRequest } from "next/server";
import { getApiOrigin } from "@/lib/server-env";

function buildTargetUrl(
  request: NextRequest,
  path: string[],
  namespace: "auth" | "backend"
) {
  const joinedPath = path.join("/");
  const targetPath =
    namespace === "auth"
      ? `/api/auth/${joinedPath}`
      : `/api/${joinedPath}`;
  const target = new URL(targetPath, getApiOrigin());

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

  const contentType = response.headers.get("content-type") ?? "";
  const responseBody =
    request.method === "HEAD" || response.status === 204 || response.status === 304
      ? null
      : contentType.includes("application/json") ||
          contentType.startsWith("text/") ||
          contentType.includes("javascript") ||
          contentType.includes("xml")
        ? await response.text()
        : new Uint8Array(await response.arrayBuffer());
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-length");
  responseHeaders.set("cache-control", "no-store");

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}
