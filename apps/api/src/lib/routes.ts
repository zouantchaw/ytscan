import type {
  ChannelCompareResponse,
  ChannelDashboard,
  ChannelSummary,
  ChannelTopicsResponse,
  ChannelTrendsResponse,
  HookLibraryResponse,
  HookSummary,
  MeResponse,
  ScanJob,
  SearchResponse,
  SearchResultItem,
  VideoSummary,
  WorkspaceSummary,
} from "@ytscan/core";
import {
  buildComparison,
  buildDashboardStats,
  buildDurationBuckets,
  buildPerformanceBreakdown,
  buildPerformanceTrend,
  buildTopicClusters,
  buildVideoUrl,
  computeMedian,
  type AnalyticsVideo,
} from "./analytics";
import { createAuth, getAllowedOrigins } from "./auth";
import type { Env } from "./env";
import { buildMeResponse, getRequestContext, type RequestContext } from "./request-context";

type ChannelRow = {
  id: number;
  slug: string;
  channel_name: string;
  channel_url: string;
  channel_youtube_id: string | null;
  total_videos: number;
  subscriber_count: number | null;
  scan_date: string;
};

type SearchFilters = {
  channelSlug: string;
  minViews: number | null;
  performanceTier: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

type ChannelAnalytics = {
  channel: ChannelRow;
  videos: AnalyticsVideo[];
  totalViews: number;
  averageViews: number;
  medianViews: number;
  totalDurationSec: number;
  averageEngagementRate: number;
  stats: ChannelDashboard["stats"];
  durationBuckets: ChannelDashboard["durationBuckets"];
  performanceTrend: ChannelDashboard["performanceTrend"];
  performanceBreakdown: ChannelDashboard["performanceBreakdown"];
  topicClusters: ChannelDashboard["topicClusters"];
};

type InternalScanJobRow = {
  id: string;
  channel_url: string;
  requested_channel_slug: string | null;
  status: string;
  stage: string;
  progress: number;
  total_videos: number | null;
  processed_videos: number | null;
  message: string | null;
  workspace_id: string | null;
  created_by_user_id: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type InternalJobPatch = {
  message?: string | null;
  processedVideos?: number | null;
  progress?: number;
  requestedChannelSlug?: string | null;
  stage?: string;
  status?: string;
  totalVideos?: number | null;
};

const BASE_CORS_HEADERS: HeadersInit = {
  "access-control-allow-headers": "Content-Type, Authorization, X-Internal-Token, X-Workspace-Id",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const JSON_HEADERS: HeadersInit = {
  "content-type": "application/json; charset=utf-8",
};

const CHANNEL_SELECT = `
  id,
  slug,
  channel_name,
  channel_url,
  channel_youtube_id,
  total_videos,
  subscriber_count,
  scan_date
`;

const VIDEO_SELECT = `
  youtube_id,
  title,
  upload_date,
  duration_sec,
  view_count,
  like_count,
  comment_count,
  description,
  tags,
  engagement_rate,
  performance_tier
`;

const HOOK_SELECT = `
  h.text,
  h.start_time,
  h.end_time,
  h.word_count,
  h.hook_type,
  v.youtube_id,
  v.title,
  v.view_count,
  v.upload_date
`;

const SEARCH_SELECT = `
  tc.vector_id,
  tc.text AS chunk_text,
  tc.start_time,
  tc.end_time,
  v.youtube_id,
  v.title,
  v.upload_date,
  v.view_count,
  v.performance_tier,
  c.slug AS channel_slug,
  c.channel_name
`;

const SCAN_JOB_SELECT = `
  id,
  channel_url,
  requested_channel_slug,
  status,
  stage,
  progress,
  total_videos,
  processed_videos,
  message,
  created_at,
  updated_at
`;

const INTERNAL_SCAN_JOB_SELECT = `
  ${SCAN_JOB_SELECT},
  workspace_id,
  created_by_user_id,
  lease_token,
  lease_expires_at,
  started_at,
  completed_at
`;

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);
  const parts = pathname.split("/").filter(Boolean);

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), request, env);
  }

  try {
    if (pathname.startsWith("/api/auth")) {
      return withCors(await createAuth(env).handler(request), request, env);
    }

    if (pathname === "/" || pathname === "/health") {
      return withCors(
        jsonResponse({
          status: "ok",
          service: "ytscan-api",
          defaultChannel: env.DEFAULT_CHANNEL_SLUG ?? null,
        }),
        request,
        env
      );
    }

    if (parts[0] === "api" && parts[1] === "internal") {
      return withCors(await handleInternalRoute(request, parts, env), request, env);
    }

    const context = await getRequestContext(request, env);
    if (!context) {
      return withCors(jsonResponse({ error: "Unauthorized" }, 401), request, env);
    }

    if (pathname === "/api/me" && request.method === "GET") {
      return withCors(getMe(context), request, env);
    }

    if (pathname === "/api/workspace" && request.method === "GET") {
      return withCors(getWorkspace(context), request, env);
    }

    if (pathname === "/api/channels" && request.method === "GET") {
      return withCors(await listChannels(context, env), request, env);
    }

    if (parts[0] === "api" && parts[1] === "channels") {
      return withCors(await handleChannelRoute(parts, url, request.method, context, env), request, env);
    }

    if (pathname === "/api/search" && request.method === "GET") {
      return withCors(await handleSearch(url, context, env), request, env);
    }

    if (pathname === "/api/compare") {
      return withCors(await handleCompare(request, url, context, env), request, env);
    }

    if (pathname === "/api/scan") {
      return withCors(await handleScanCollection(request, context, env), request, env);
    }

    if (parts[0] === "api" && parts[1] === "scan" && parts[2] && request.method === "GET") {
      return withCors(await getScanJob(parts[2], context, env), request, env);
    }

    if (parts[0] === "api" && parts[2] && request.method === "GET") {
      if (parts[1] === "hooks") return withCors(await getHookLibrary(parts[2], url, context, env), request, env);
      if (parts[1] === "topics") return withCors(await getChannelTopics(parts[2], url, context, env), request, env);
      if (parts[1] === "trends") return withCors(await getChannelTrends(parts[2], context, env), request, env);
    }

    return withCors(jsonResponse({ error: "Not found" }, 404), request, env);
  } catch (error) {
    console.error("Unhandled worker error", error);
    return withCors(jsonResponse({ error: "Internal server error" }, 500), request, env);
  }
}

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function buildCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin) return BASE_CORS_HEADERS;

  try {
    const normalizedOrigin = new URL(origin).origin;
    if (!getAllowedOrigins(env).includes(normalizedOrigin)) {
      return BASE_CORS_HEADERS;
    }

    return {
      ...BASE_CORS_HEADERS,
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": normalizedOrigin,
      vary: "Origin",
    };
  } catch {
    return BASE_CORS_HEADERS;
  }
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(buildCorsHeaders(request, env))) {
    if (value) headers.set(key, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function clampLimit(rawValue: string | null, fallback: number, max: number): number {
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function buildTimestampLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  if (hours > 0) {
    return [hours, minutes, remainingSeconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  }
  return [minutes, remainingSeconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function buildSnippet(text: string, maxLength = 280): string {
  const normalized = dedupeRepeatedPhrases(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function extractEmbedding(response: unknown): number[] | null {
  const payload: any = response;

  if (Array.isArray(payload?.data) && payload.data.length > 0) {
    const first = payload.data[0];
    if (Array.isArray(first)) return first;
    if (Array.isArray(first?.embedding)) return first.embedding;
  }

  if (Array.isArray(payload?.result?.data) && payload.result.data.length > 0) {
    const first = payload.result.data[0];
    if (Array.isArray(first)) return first;
    if (Array.isArray(first?.embedding)) return first.embedding;
  }

  return null;
}

function averageValue(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildChannelSummary(row: ChannelRow): ChannelSummary {
  return {
    slug: row.slug,
    channelName: row.channel_name,
    channelUrl: row.channel_url,
    channelYoutubeId: row.channel_youtube_id,
    totalVideos: Number(row.total_videos ?? 0),
    subscriberCount: row.subscriber_count ? Number(row.subscriber_count) : null,
    scanDate: row.scan_date,
  };
}

function getMe(context: RequestContext): Response {
  const response: MeResponse = buildMeResponse(context);
  return jsonResponse(response);
}

function getWorkspace(context: RequestContext): Response {
  const workspace: WorkspaceSummary = buildMeResponse(context).workspace;
  return jsonResponse({ workspace });
}

function isInternalAuthorized(request: Request, env: Env): boolean {
  const providedToken = request.headers.get("x-internal-token")?.trim();
  return Boolean(env.INTERNAL_RUNNER_TOKEN) && providedToken === env.INTERNAL_RUNNER_TOKEN;
}

async function handleInternalRoute(
  request: Request,
  parts: string[],
  env: Env
): Promise<Response> {
  if (!isInternalAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (parts[2] !== "scan-jobs") {
    return jsonResponse({ error: "Not found" }, 404);
  }

  if (parts.length === 3 && request.method === "POST") {
    return leaseScanJob(request, env);
  }

  if (!parts[3] || request.method !== "POST") {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const jobId = decodeURIComponent(parts[3]);
  const action = parts[4];

  if (action === "heartbeat") return heartbeatScanJob(jobId, request, env);
  if (action === "progress") return patchScanJob(jobId, request, env);
  if (action === "complete") return completeScanJob(jobId, request, env);
  if (action === "fail") return failScanJob(jobId, request, env);

  return jsonResponse({ error: "Not found" }, 404);
}

async function fetchInternalScanJob(
  jobId: string,
  env: Env
): Promise<InternalScanJobRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${INTERNAL_SCAN_JOB_SELECT} FROM scan_jobs WHERE id = ? LIMIT 1`
  )
    .bind(jobId)
    .first<InternalScanJobRow>();

  return row ?? null;
}

async function recordScanJobEvent(
  jobId: string,
  row: Partial<InternalScanJobRow>,
  metadata: Record<string, unknown>,
  env: Env
): Promise<void> {
  const now = new Date().toISOString();

  await env.DB.prepare(
    `
      INSERT INTO scan_job_events (
        id,
        scan_job_id,
        stage,
        status,
        progress,
        message,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      crypto.randomUUID(),
      jobId,
      row.stage ?? "queued",
      row.status ?? "queued",
      row.progress ?? 0,
      compactMessage(row.message),
      JSON.stringify(metadata),
      now
    )
    .run();
}

function compactMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 400) : null;
}

async function leaseScanJob(request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const requestedJobId = String(payload?.jobId ?? "").trim() || null;

  const row = requestedJobId
    ? await env.DB.prepare(
        `SELECT ${INTERNAL_SCAN_JOB_SELECT} FROM scan_jobs WHERE id = ? AND status = 'queued' LIMIT 1`
      )
        .bind(requestedJobId)
        .first<InternalScanJobRow>()
    : await env.DB.prepare(
        `SELECT ${INTERNAL_SCAN_JOB_SELECT} FROM scan_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`
      ).first<InternalScanJobRow>();

  if (!row) {
    return jsonResponse({ job: null });
  }

  const now = new Date().toISOString();
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `
      UPDATE scan_jobs
      SET
        status = 'running',
        lease_token = ?,
        lease_expires_at = ?,
        started_at = COALESCE(started_at, ?),
        updated_at = ?
      WHERE id = ?
    `
  )
    .bind(leaseToken, leaseExpiresAt, now, now, row.id)
    .run();

  const leased = await fetchInternalScanJob(row.id, env);
  if (!leased) return jsonResponse({ job: null });

  await recordScanJobEvent(
    row.id,
    {
      message: leased.message,
      progress: leased.progress,
      stage: leased.stage,
      status: leased.status,
    },
    { leaseExpiresAt, leaseTokenIssued: true },
    env
  );

  return jsonResponse({
    job: {
      ...toScanJob(leased),
      leaseToken,
    },
  });
}

async function heartbeatScanJob(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const leaseToken = String(payload?.leaseToken ?? "").trim();

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  const row = await fetchInternalScanJob(jobId, env);
  if (!row) return jsonResponse({ error: "Scan job not found" }, 404);
  if (row.lease_token !== leaseToken) {
    return jsonResponse({ error: "Lease token mismatch" }, 409);
  }

  const now = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `UPDATE scan_jobs SET lease_expires_at = ?, updated_at = ? WHERE id = ? AND lease_token = ?`
  )
    .bind(leaseExpiresAt, now, jobId, leaseToken)
    .run();

  return jsonResponse({
    job: {
      ...toScanJob({
        ...row,
        lease_expires_at: leaseExpiresAt,
        updated_at: now,
      }),
      leaseToken,
    },
  });
}

async function updateInternalScanJob(
  jobId: string,
  leaseToken: string,
  patch: InternalJobPatch,
  env: Env
): Promise<InternalScanJobRow | null> {
  const row = await fetchInternalScanJob(jobId, env);
  if (!row) return null;
  if (row.lease_token !== leaseToken) {
    throw new Error("Lease token mismatch");
  }

  const now = new Date().toISOString();
  const assignments = ["updated_at = ?"];
  const binds: unknown[] = [now];

  if (patch.status !== undefined) {
    assignments.push("status = ?");
    binds.push(patch.status);
  }

  if (patch.stage !== undefined) {
    assignments.push("stage = ?");
    binds.push(patch.stage);
  }

  if (patch.progress !== undefined) {
    assignments.push("progress = ?");
    binds.push(patch.progress);
  }

  if (patch.totalVideos !== undefined) {
    assignments.push("total_videos = ?");
    binds.push(patch.totalVideos);
  }

  if (patch.processedVideos !== undefined) {
    assignments.push("processed_videos = ?");
    binds.push(patch.processedVideos);
  }

  if (patch.message !== undefined) {
    assignments.push("message = ?");
    binds.push(compactMessage(patch.message));
  }

  if (patch.requestedChannelSlug !== undefined) {
    assignments.push("requested_channel_slug = ?");
    binds.push(patch.requestedChannelSlug);
  }

  binds.push(jobId, leaseToken);

  await env.DB.prepare(
    `UPDATE scan_jobs SET ${assignments.join(", ")} WHERE id = ? AND lease_token = ?`
  )
    .bind(...binds)
    .run();

  const updated = await fetchInternalScanJob(jobId, env);
  if (!updated) return null;

  await recordScanJobEvent(
    jobId,
    {
      message: updated.message,
      progress: updated.progress,
      stage: updated.stage,
      status: updated.status,
    },
    patch,
    env
  );

  return updated;
}

async function patchScanJob(jobId: string, request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const leaseToken = String(payload?.leaseToken ?? "").trim();

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  try {
    const updated = await updateInternalScanJob(
      jobId,
      leaseToken,
      {
        message:
          payload?.message === undefined || payload?.message === null
            ? undefined
            : String(payload.message),
        processedVideos: parseInteger(
          payload?.processedVideos === undefined || payload?.processedVideos === null
            ? null
            : String(payload.processedVideos)
        ),
        progress:
          payload?.progress === undefined || payload?.progress === null
            ? undefined
            : Number(payload.progress),
        requestedChannelSlug:
          payload?.requestedChannelSlug === undefined || payload?.requestedChannelSlug === null
            ? undefined
            : String(payload.requestedChannelSlug),
        stage:
          payload?.stage === undefined || payload?.stage === null ? undefined : String(payload.stage),
        status:
          payload?.status === undefined || payload?.status === null
            ? undefined
            : String(payload.status),
        totalVideos: parseInteger(
          payload?.totalVideos === undefined || payload?.totalVideos === null
            ? null
            : String(payload.totalVideos)
        ),
      },
      env
    );

    if (!updated) return jsonResponse({ error: "Scan job not found" }, 404);
    return jsonResponse({ job: { ...toScanJob(updated), leaseToken } });
  } catch (error) {
    if (error instanceof Error && error.message === "Lease token mismatch") {
      return jsonResponse({ error: error.message }, 409);
    }

    throw error;
  }
}

async function completeScanJob(jobId: string, request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const leaseToken = String(payload?.leaseToken ?? "").trim();

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  const updated = await updateInternalScanJob(
    jobId,
    leaseToken,
    {
      message:
        payload?.message === undefined || payload?.message === null
          ? "Completed scan job"
          : String(payload.message),
      processedVideos: parseInteger(
        payload?.processedVideos === undefined || payload?.processedVideos === null
          ? null
          : String(payload.processedVideos)
      ),
      progress: 1,
      requestedChannelSlug:
        payload?.requestedChannelSlug === undefined || payload?.requestedChannelSlug === null
          ? undefined
          : String(payload.requestedChannelSlug),
      stage: "completed",
      status: "completed",
      totalVideos: parseInteger(
        payload?.totalVideos === undefined || payload?.totalVideos === null
          ? null
          : String(payload.totalVideos)
      ),
    },
    env
  );

  if (!updated) return jsonResponse({ error: "Scan job not found" }, 404);

  const completedAt = new Date().toISOString();
  await env.DB.prepare(
    `
      UPDATE scan_jobs
      SET lease_token = NULL, lease_expires_at = NULL, completed_at = ?, updated_at = ?
      WHERE id = ?
    `
  )
    .bind(completedAt, completedAt, jobId)
    .run();

  const completed = await fetchInternalScanJob(jobId, env);
  return jsonResponse({ job: { ...toScanJob(completed ?? updated), leaseToken: null } });
}

async function failScanJob(jobId: string, request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const leaseToken = String(payload?.leaseToken ?? "").trim();

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  const updated = await updateInternalScanJob(
    jobId,
    leaseToken,
    {
      message:
        payload?.message === undefined || payload?.message === null
          ? "Scan job failed"
          : String(payload.message),
      progress:
        payload?.progress === undefined || payload?.progress === null
          ? undefined
          : Number(payload.progress),
      stage: payload?.stage ? String(payload.stage) : "failed",
      status: "failed",
    },
    env
  );

  if (!updated) return jsonResponse({ error: "Scan job not found" }, 404);

  const completedAt = new Date().toISOString();
  await env.DB.prepare(
    `
      UPDATE scan_jobs
      SET lease_token = NULL, lease_expires_at = NULL, completed_at = ?, updated_at = ?
      WHERE id = ?
    `
  )
    .bind(completedAt, completedAt, jobId)
    .run();

  const failed = await fetchInternalScanJob(jobId, env);
  return jsonResponse({ job: { ...toScanJob(failed ?? updated), leaseToken: null } });
}

function parseTags(rawValue: unknown): string[] {
  if (Array.isArray(rawValue)) return rawValue.map(String);
  if (typeof rawValue !== "string" || rawValue.trim() === "") return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseSearchFilters(url: URL, defaultChannelSlug: string | undefined): SearchFilters {
  return {
    channelSlug: url.searchParams.get("channel")?.trim() || defaultChannelSlug || "",
    minViews: parseInteger(url.searchParams.get("minViews") ?? url.searchParams.get("min_views")),
    performanceTier:
      url.searchParams.get("performanceTier")?.trim() ??
      url.searchParams.get("performance_tier")?.trim() ??
      null,
    dateFrom:
      url.searchParams.get("dateFrom")?.trim() ??
      url.searchParams.get("date_from")?.trim() ??
      null,
    dateTo:
      url.searchParams.get("dateTo")?.trim() ??
      url.searchParams.get("date_to")?.trim() ??
      null,
  };
}

function parseInteger(rawValue: string | null): number | null {
  if (!rawValue) return null;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSearchFilterClause(
  filters: SearchFilters,
  workspaceId: string
): { clauses: string[]; binds: unknown[] } {
  const clauses: string[] = ["c.workspace_id = ?"];
  const binds: unknown[] = [workspaceId];

  if (filters.channelSlug) {
    clauses.push("c.slug = ?");
    binds.push(filters.channelSlug);
  }

  if (filters.minViews !== null) {
    clauses.push("v.view_count >= ?");
    binds.push(filters.minViews);
  }

  if (filters.performanceTier) {
    clauses.push("v.performance_tier = ?");
    binds.push(filters.performanceTier);
  }

  if (filters.dateFrom) {
    clauses.push("v.upload_date >= ?");
    binds.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push("v.upload_date <= ?");
    binds.push(filters.dateTo);
  }

  return { clauses, binds };
}

async function handleChannelRoute(
  parts: string[],
  url: URL,
  method: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  if (!parts[2]) {
    return jsonResponse({ error: "Channel slug is required" }, 400);
  }

  const slug = decodeURIComponent(parts[2]);

  if (parts.length === 3) {
    if (method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);
    return getChannelDashboard(slug, context, env);
  }

  if (method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (parts[3] === "hooks") return getHookLibrary(slug, url, context, env);
  if (parts[3] === "topics") return getChannelTopics(slug, url, context, env);
  if (parts[3] === "trends") return getChannelTrends(slug, context, env);

  return jsonResponse({ error: "Not found" }, 404);
}

async function handleCompare(
  request: Request,
  url: URL,
  context: RequestContext,
  env: Env
): Promise<Response> {
  let leftSlug = url.searchParams.get("left")?.trim() ?? url.searchParams.get("channel_1")?.trim() ?? "";
  let rightSlug =
    url.searchParams.get("right")?.trim() ?? url.searchParams.get("channel_2")?.trim() ?? "";

  if (request.method === "POST") {
    const payload = await readJsonBody<Record<string, unknown>>(request);
    leftSlug =
      String(payload?.left ?? payload?.channel_1 ?? payload?.channel_id_1 ?? leftSlug).trim();
    rightSlug =
      String(payload?.right ?? payload?.channel_2 ?? payload?.channel_id_2 ?? rightSlug).trim();
  } else if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!leftSlug || !rightSlug) {
    return jsonResponse({ error: "Both left and right channel slugs are required" }, 400);
  }

  if (leftSlug === rightSlug) {
    return jsonResponse({ error: "Choose two different channels to compare" }, 400);
  }

  const [left, right] = await Promise.all([
    getChannelAnalytics(leftSlug, context, env),
    getChannelAnalytics(rightSlug, context, env),
  ]);

  if (!left || !right) {
    return jsonResponse({ error: "One or both channels were not found" }, 404);
  }

  const response: ChannelCompareResponse = buildComparison(
    {
      slug: left.channel.slug,
      channelName: left.channel.channel_name,
      totalVideos: left.videos.length,
      averageViews: left.averageViews,
      medianViews: left.medianViews,
      averageEngagementRate: left.averageEngagementRate,
      uploadCadencePerWeek: left.stats.uploadCadencePerWeek.current,
      bestDuration: left.stats.bestDuration,
      topicClusters: left.topicClusters,
    },
    {
      slug: right.channel.slug,
      channelName: right.channel.channel_name,
      totalVideos: right.videos.length,
      averageViews: right.averageViews,
      medianViews: right.medianViews,
      averageEngagementRate: right.averageEngagementRate,
      uploadCadencePerWeek: right.stats.uploadCadencePerWeek.current,
      bestDuration: right.stats.bestDuration,
      topicClusters: right.topicClusters,
    }
  );

  return jsonResponse(response);
}

async function handleScanCollection(
  request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  if (request.method === "GET") {
    return listScanJobs(context, env);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const payload = await readJsonBody<Record<string, unknown>>(request);
  const channelUrl = String(payload?.channelUrl ?? payload?.channel_url ?? "").trim();

  if (!channelUrl) {
    return jsonResponse({ error: "channelUrl is required" }, 400);
  }

  const parsedUrl = parseYouTubeUrl(channelUrl);
  if (!parsedUrl) {
    return jsonResponse({ error: "A valid YouTube channel URL is required" }, 400);
  }

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const requestedChannelSlug = deriveRequestedChannelSlug(parsedUrl);
  const message = "Queued for offline ingest orchestration";

  await env.DB.prepare(
    `
      INSERT INTO scan_jobs (
        id,
        channel_url,
        requested_channel_slug,
        status,
        stage,
        progress,
        total_videos,
        processed_videos,
        message,
        workspace_id,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'queued', 'queued', 0, NULL, NULL, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      jobId,
      parsedUrl.toString(),
      requestedChannelSlug,
      message,
      context.workspace.id,
      context.session.user.id,
      now,
      now
    )
    .run();

  return jsonResponse(
    {
      job: toScanJob({
        id: jobId,
        channel_url: parsedUrl.toString(),
        requested_channel_slug: requestedChannelSlug,
        status: "queued",
        stage: "queued",
        progress: 0,
        total_videos: null,
        processed_videos: null,
        message,
        created_at: now,
        updated_at: now,
      }),
    },
    202
  );
}

async function listChannels(context: RequestContext, env: Env): Promise<Response> {
  const { results = [] } = await env.DB.prepare(
    `SELECT ${CHANNEL_SELECT} FROM channels WHERE workspace_id = ? ORDER BY scan_date DESC, channel_name ASC`
  )
    .bind(context.workspace.id)
    .all<ChannelRow>();

  const items: ChannelSummary[] = results.map(buildChannelSummary);
  return jsonResponse({ items, count: items.length });
}

async function getChannelDashboard(
  slug: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const analytics = await getChannelAnalytics(slug, context, env);
  if (!analytics) {
    return jsonResponse({ error: "Channel not found" }, 404);
  }

  const topVideos = buildTopVideos(analytics.videos, 10);
  const topHooks = await fetchHooks(analytics.channel.id, env, {
    limit: 12,
    sort: "views",
  });

  const dashboard: ChannelDashboard = {
    ...buildChannelSummary(analytics.channel),
    totalViews: analytics.totalViews,
    averageViews: analytics.averageViews,
    medianViews: analytics.medianViews,
    totalDurationSec: analytics.totalDurationSec,
    averageEngagementRate: analytics.averageEngagementRate,
    stats: analytics.stats,
    durationBuckets: analytics.durationBuckets,
    performanceTrend: analytics.performanceTrend,
    performanceBreakdown: analytics.performanceBreakdown,
    topicClusters: analytics.topicClusters,
    topVideos,
    topHooks,
  };

  return jsonResponse(dashboard);
}

async function getHookLibrary(
  slug: string,
  url: URL,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const channel = await findChannel(slug, context, env);
  if (!channel) return jsonResponse({ error: "Channel not found" }, 404);

  const response: HookLibraryResponse = {
    channel: slug,
    items: await fetchHooks(channel.id, env, {
      limit: clampLimit(url.searchParams.get("limit"), 25, 100),
      sort: url.searchParams.get("sort") === "recent" ? "recent" : "views",
      hookType: url.searchParams.get("hookType")?.trim() ?? url.searchParams.get("hook_type")?.trim() ?? null,
    }),
    count: 0,
    sort: url.searchParams.get("sort") === "recent" ? "recent" : "views",
  };

  response.count = response.items.length;
  return jsonResponse(response);
}

async function getChannelTopics(
  slug: string,
  url: URL,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const analytics = await getChannelAnalytics(slug, context, env);
  if (!analytics) return jsonResponse({ error: "Channel not found" }, 404);

  const limit = clampLimit(url.searchParams.get("limit"), 8, 25);
  const response: ChannelTopicsResponse = {
    channel: slug,
    items: analytics.topicClusters.slice(0, limit),
    count: Math.min(analytics.topicClusters.length, limit),
  };

  return jsonResponse(response);
}

async function getChannelTrends(
  slug: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const analytics = await getChannelAnalytics(slug, context, env);
  if (!analytics) return jsonResponse({ error: "Channel not found" }, 404);

  const response: ChannelTrendsResponse = {
    channel: slug,
    items: analytics.performanceTrend,
    durationBuckets: analytics.durationBuckets,
    performanceBreakdown: analytics.performanceBreakdown,
  };

  return jsonResponse(response);
}

async function listScanJobs(context: RequestContext, env: Env): Promise<Response> {
  const { results = [] } = await env.DB.prepare(
    `SELECT ${SCAN_JOB_SELECT} FROM scan_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 25`
  )
    .bind(context.workspace.id)
    .all<Record<string, unknown>>();

  const items = results.map(toScanJob);
  return jsonResponse({ items, count: items.length });
}

async function getScanJob(
  jobId: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT ${SCAN_JOB_SELECT} FROM scan_jobs WHERE id = ? AND workspace_id = ? LIMIT 1`
  )
    .bind(jobId, context.workspace.id)
    .first<Record<string, unknown>>();

  if (!row) return jsonResponse({ error: "Scan job not found" }, 404);
  return jsonResponse({ job: toScanJob(row) });
}

async function handleSearch(
  url: URL,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const query = url.searchParams.get("q")?.trim();
  if (!query) {
    return jsonResponse({ error: "Missing q query parameter" }, 400);
  }

  const mode = url.searchParams.get("mode")?.trim() === "text" ? "text" : "semantic";
  const limit = clampLimit(url.searchParams.get("limit"), 10, 25);
  const filters = parseSearchFilters(url, env.DEFAULT_CHANNEL_SLUG);

  if (mode === "semantic") {
    const semanticItems = await runSemanticSearch(query, filters, limit, context, env);
    if (semanticItems) {
      return jsonResponse(toSearchResponse(semanticItems, "semantic", filters.channelSlug || null, query));
    }
  }

  const textItems = await runTextSearch(query, filters, limit, context, env);
  return jsonResponse(
    toSearchResponse(textItems, "text", filters.channelSlug || null, query, mode === "semantic")
  );
}

async function runTextSearch(
  query: string,
  filters: SearchFilters,
  limit: number,
  context: RequestContext,
  env: Env
): Promise<SearchResultItem[]> {
  const queryPattern = `%${query.toLowerCase()}%`;
  const { clauses, binds } = buildSearchFilterClause(filters, context.workspace.id);
  const whereClauses = ["LOWER(tc.text) LIKE ?", ...clauses];
  const sql = `
    SELECT ${SEARCH_SELECT}
    FROM transcript_chunks tc
    JOIN videos v ON v.id = tc.video_id
    JOIN channels c ON c.id = v.channel_id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY v.view_count DESC, tc.start_time ASC
    LIMIT ?
  `;

  const { results = [] } = await env.DB.prepare(sql)
    .bind(queryPattern, ...binds, limit)
    .all<Record<string, unknown>>();

  return results.map((row) => toSearchResultItem(row));
}

async function runSemanticSearch(
  query: string,
  filters: SearchFilters,
  limit: number,
  context: RequestContext,
  env: Env
): Promise<SearchResultItem[] | null> {
  if (!env.AI || !env.TRANSCRIPTS_INDEX) return null;

  try {
    const embeddingResponse = await env.AI.run("@cf/baai/bge-m3", { text: [query] });
    const embedding = extractEmbedding(embeddingResponse);
    if (!embedding) return null;

    const vectorResults = await env.TRANSCRIPTS_INDEX.query(embedding, {
      topK: Math.min(Math.max(limit * 4, limit), 75),
      returnMetadata: true,
      returnValues: false,
    });

    if (!vectorResults.matches?.length) return [];

    const vectorIds = vectorResults.matches.map((match) => match.id);
    const placeholders = vectorIds.map(() => "?").join(", ");
    const { clauses, binds } = buildSearchFilterClause(filters, context.workspace.id);
    const filterClause = clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "";
    const sql = `
      SELECT ${SEARCH_SELECT}
      FROM transcript_chunks tc
      JOIN videos v ON v.id = tc.video_id
      JOIN channels c ON c.id = v.channel_id
      WHERE tc.vector_id IN (${placeholders})${filterClause}
    `;

    const { results = [] } = await env.DB.prepare(sql)
      .bind(...vectorIds, ...binds)
      .all<Record<string, unknown>>();

    const rowMap = new Map(results.map((row) => [String(row.vector_id), row]));
    const items: SearchResultItem[] = [];

    for (const match of vectorResults.matches) {
      const row = rowMap.get(match.id);
      if (!row) continue;
      items.push(toSearchResultItem(row, match.score));
      if (items.length >= limit) break;
    }

    return items;
  } catch (error) {
    console.error("Semantic search failed", error);
    return null;
  }
}

async function getChannelAnalytics(
  slug: string,
  context: RequestContext,
  env: Env
): Promise<ChannelAnalytics | null> {
  const channel = await findChannel(slug, context, env);
  if (!channel) return null;

  const { results = [] } = await env.DB.prepare(
    `SELECT ${VIDEO_SELECT} FROM videos WHERE channel_id = ? ORDER BY upload_date DESC`
  )
    .bind(channel.id)
    .all<Record<string, unknown>>();

  const videos: AnalyticsVideo[] = results.map((row) => ({
    youtubeId: String(row.youtube_id),
    title: String(row.title ?? ""),
    uploadDate: String(row.upload_date ?? ""),
    durationSec: Number(row.duration_sec ?? 0),
    viewCount: Number(row.view_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    description: String(row.description ?? ""),
    tags: parseTags(row.tags),
    engagementRate: Number(row.engagement_rate ?? 0),
    performanceTier: String(row.performance_tier ?? "average"),
    videoUrl: buildVideoUrl(String(row.youtube_id)),
  }));

  const totalViews = videos.reduce((sum, video) => sum + video.viewCount, 0);
  const totalDurationSec = videos.reduce((sum, video) => sum + video.durationSec, 0);
  const averageViews = Math.round(totalViews / Math.max(videos.length, 1));
  const averageEngagementRate = roundTo(
    averageValue(videos.map((video) => video.engagementRate)),
    4
  );

  return {
    channel,
    videos,
    totalViews,
    averageViews,
    medianViews: computeMedian(videos.map((video) => video.viewCount)),
    totalDurationSec,
    averageEngagementRate,
    stats: buildDashboardStats(videos),
    durationBuckets: buildDurationBuckets(videos),
    performanceTrend: buildPerformanceTrend(videos),
    performanceBreakdown: buildPerformanceBreakdown(videos),
    topicClusters: buildTopicClusters(videos),
  };
}

async function findChannel(
  slug: string,
  context: RequestContext,
  env: Env
): Promise<ChannelRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${CHANNEL_SELECT} FROM channels WHERE slug = ? AND workspace_id = ? LIMIT 1`
  )
    .bind(slug, context.workspace.id)
    .first<ChannelRow>();

  return row ?? null;
}

function buildTopVideos(videos: AnalyticsVideo[], limit: number): VideoSummary[] {
  return [...videos]
    .sort((left, right) => {
      if (right.viewCount !== left.viewCount) return right.viewCount - left.viewCount;
      return right.uploadDate.localeCompare(left.uploadDate);
    })
    .slice(0, limit)
    .map((video) => ({
      youtubeId: video.youtubeId,
      title: video.title,
      uploadDate: video.uploadDate,
      durationSec: video.durationSec,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      performanceTier: video.performanceTier,
      videoUrl: video.videoUrl,
    }));
}

async function fetchHooks(
  channelId: number,
  env: Env,
  options: { limit: number; sort: "views" | "recent"; hookType?: string | null }
): Promise<HookSummary[]> {
  const conditions = ["v.channel_id = ?"];
  const binds: unknown[] = [channelId];

  if (options.hookType) {
    conditions.push("h.hook_type = ?");
    binds.push(options.hookType);
  }

  const orderBy =
    options.sort === "recent" ? "v.upload_date DESC, h.start_time ASC" : "v.view_count DESC, h.start_time ASC";

  const sql = `
    SELECT ${HOOK_SELECT}
    FROM hooks h
    JOIN videos v ON v.id = h.video_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ?
  `;

  const { results = [] } = await env.DB.prepare(sql)
    .bind(...binds, options.limit)
    .all<Record<string, unknown>>();

  return results.map((row) => ({
    text: buildSnippet(String(row.text ?? ""), 320),
    startTime: Number(row.start_time ?? 0),
    endTime: Number(row.end_time ?? 0),
    timestampLabel: buildTimestampLabel(Number(row.start_time ?? 0)),
    wordCount: Number(row.word_count ?? 0),
    hookType: String(row.hook_type ?? "unknown"),
    youtubeId: String(row.youtube_id),
    videoTitle: String(row.title ?? ""),
    viewCount: Number(row.view_count ?? 0),
    videoUrl: buildVideoUrl(String(row.youtube_id)),
  }));
}

function toSearchResponse(
  items: SearchResultItem[],
  mode: "text" | "semantic",
  channel: string | null,
  query: string,
  fallbackUsed?: boolean
): SearchResponse {
  return {
    items,
    count: items.length,
    videoCount: new Set(items.map((item) => item.youtubeId)).size,
    mode,
    channel,
    query,
    fallbackUsed,
  };
}

function toSearchResultItem(row: Record<string, unknown>, score?: number): SearchResultItem {
  const startTime = Number(row.start_time ?? 0);
  const youtubeId = String(row.youtube_id);

  return {
    vectorId: String(row.vector_id ?? ""),
    text: String(row.chunk_text ?? ""),
    snippet: buildSnippet(String(row.chunk_text ?? "")),
    startTime,
    endTime: Number(row.end_time ?? 0),
    timestampLabel: buildTimestampLabel(startTime),
    youtubeId,
    title: String(row.title ?? ""),
    uploadDate: String(row.upload_date ?? ""),
    viewCount: Number(row.view_count ?? 0),
    performanceTier: String(row.performance_tier ?? "average"),
    channelSlug: String(row.channel_slug ?? ""),
    channelName: String(row.channel_name ?? ""),
    videoUrl: buildVideoUrl(youtubeId),
    score,
  };
}

function toScanJob(row: Record<string, unknown>): ScanJob {
  return {
    jobId: String(row.id),
    channelUrl: String(row.channel_url ?? ""),
    requestedChannelSlug: row.requested_channel_slug
      ? String(row.requested_channel_slug)
      : null,
    status: String(row.status ?? "queued"),
    stage: String(row.stage ?? "queued"),
    progress: Number(row.progress ?? 0),
    totalVideos: row.total_videos === null || row.total_videos === undefined ? null : Number(row.total_videos),
    processedVideos:
      row.processed_videos === null || row.processed_videos === undefined
        ? null
        : Number(row.processed_videos),
    message: row.message ? String(row.message) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

async function readJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }

  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

function parseYouTubeUrl(rawValue: string): URL | null {
  try {
    const parsed = new URL(rawValue);
    const hostname = parsed.hostname.toLowerCase();
    const supportedHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
    return supportedHosts.includes(hostname) ? parsed : null;
  } catch {
    return null;
  }
}

function deriveRequestedChannelSlug(channelUrl: URL): string | null {
  const pathname = channelUrl.pathname.replace(/\/+$/, "");
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const handleSegment = segments.find((segment) => segment.startsWith("@"));
  if (handleSegment) return slugify(handleSegment.slice(1));

  const finalSegment = segments[segments.length - 1] ?? "";
  return finalSegment ? slugify(finalSegment) : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function dedupeRepeatedPhrases(text: string): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return "";

  const result: string[] = [];
  let index = 0;

  while (index < words.length) {
    let skipped = false;

    for (let size = 12; size >= 4; size -= 1) {
      const current = words.slice(index, index + size);
      const next = words.slice(index + size, index + size * 2);
      if (current.length !== size || next.length !== size) continue;

      const currentPhrase = current.join(" ").toLowerCase();
      const nextPhrase = next.join(" ").toLowerCase();
      if (currentPhrase !== nextPhrase) continue;

      result.push(...current);
      index += size * 2;
      skipped = true;
      break;
    }

    if (skipped) continue;

    result.push(words[index] ?? "");
    index += 1;
  }

  return result.join(" ").trim();
}
