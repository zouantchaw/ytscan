import { NextRequest, NextResponse } from "next/server";
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

async function proxyToTarget(request: NextRequest, target: URL) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
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
      ? ""
      : contentType.includes("application/json") ||
          contentType.startsWith("text/") ||
          contentType.includes("javascript") ||
          contentType.includes("xml")
        ? await response.text()
        : Buffer.from(await response.arrayBuffer());
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-length");
  responseHeaders.set("cache-control", "no-store");

  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function proxyApiRequest(
  request: NextRequest,
  path: string[],
  namespace: "auth" | "backend"
) {
  return proxyToTarget(request, buildTargetUrl(request, path, namespace));
}

export async function proxyApiPath(request: NextRequest, targetPath: string) {
  const target = new URL(targetPath, getApiOrigin());
  target.search = request.nextUrl.search;
  return proxyToTarget(request, target);
}

export async function proxyJsonApiPath(request: NextRequest, targetPath: string) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const target = new URL(targetPath, getApiOrigin());
  target.search = request.nextUrl.search;

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

  const responseText =
    request.method === "HEAD" || response.status === 204 || response.status === 304
      ? ""
      : await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const isJsonResponse = contentType.includes("application/json");
  const payload = responseText
    ? (() => {
        try {
          return JSON.parse(responseText) as unknown;
        } catch {
          return null;
        }
      })()
    : null;

  if (response.ok && responseText === "") {
    return Response.json(
      {
        error: `Upstream JSON API returned an empty response for ${targetPath}.`,
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  if (responseText && !payload && isJsonResponse) {
    return Response.json(
      {
        error: `Upstream JSON API returned invalid JSON for ${targetPath}.`,
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  if (response.ok && responseText && !isJsonResponse) {
    return Response.json(
      {
        error: `Upstream JSON API returned a non-JSON response for ${targetPath}.`,
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const normalizedPayload =
    payload ??
    (responseText
      ? {
          error: responseText,
        }
      : null);

  return Response.json(normalizedPayload, {
    status: response.ok ? response.status : response.status || 502,
    headers: {
      "cache-control": "no-store",
    },
  });
}
