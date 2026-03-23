import type {
  ChannelCompareResponse,
  ChannelDashboard,
  ChannelOpportunitiesResponse,
  ChannelOpportunity,
  ChannelOpportunityEvidence,
  ChannelSummary,
  ChannelTopicsResponse,
  ChannelTrendsResponse,
  ChannelVideosResponse,
  GenerationAssetSummary,
  GenerationJobSummary,
  HookLibraryResponse,
  HookSummary,
  JsonObject,
  MeResponse,
  PersonaModelDetail,
  PersonaModelListResponse,
  PersonaModelResponse,
  PersonaModelSummary,
  ScanJob,
  SearchResponse,
  SearchResultItem,
  ScriptLabStep,
  ScriptOutputVersion,
  ScriptProjectDetail,
  ScriptProjectListResponse,
  ScriptProjectResponse,
  ScriptProjectSummary,
  ScriptResearchItem,
  ThumbnailAnalysisSummary,
  ThumbnailBriefVersion,
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
import {
  launchLambdaInstance,
  resolveLambdaLaunchPlan,
  terminateLambdaInstances,
} from "./lambda";
import { buildMeResponse, getRequestContext, type RequestContext } from "./request-context";
import {
  buildPersonaDatasetLines,
  generateScriptLabStep,
  type ScriptLabGenerationContext,
} from "./script-lab";

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

type ScriptProjectRow = {
  id: string;
  workspace_id: string;
  channel_id: number | null;
  persona_model_id: string | null;
  opportunity_json: string | null;
  title: string;
  topic: string;
  status: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  channel_slug: string | null;
  channel_name: string | null;
  research_item_count: number;
  latest_output_step: string | null;
  latest_output_version: number | null;
};

type ScriptResearchItemRow = {
  id: string;
  project_id: string;
  item_type: string;
  source_channel_slug: string | null;
  source_youtube_id: string | null;
  source_vector_id: string | null;
  title: string | null;
  excerpt: string | null;
  score: number | null;
  metadata_json: string;
  created_at: string;
};

type OpportunityCandidate = {
  id: string;
  opportunityType: ChannelOpportunity["opportunityType"];
  title: string;
  topic: string;
  angle: string;
  rationale: string;
  whyNow: string;
  recommendedHook: string;
  recommendedFormat: string;
  recommendedDuration: string;
  thumbnailDirection: string;
  score: number;
  channelEvidence: ChannelOpportunityEvidence[];
  competitorEvidence: ChannelOpportunityEvidence[];
  packageSeed: {
    title: string;
    topic: string;
  };
};

type ScriptOutputRow = {
  id: string;
  project_id: string;
  step: string;
  version: number;
  model_key: string | null;
  content: string;
  metadata_json: string;
  created_by_user_id: string | null;
  created_at: string;
};

type ThumbnailBriefRow = {
  id: string;
  project_id: string;
  version: number;
  content: string;
  metadata_json: string;
  created_at: string;
};

type GenerationJobRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  persona_model_id: string | null;
  job_type: string;
  provider: string;
  provider_job_id: string | null;
  status: string;
  stage: string;
  progress: number;
  input_json: string;
  output_json: string;
  message: string | null;
  error_message: string | null;
  created_by_user_id: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type InternalGenerationJobRow = GenerationJobRow;

type InternalGenerationJobPatch = {
  errorMessage?: string | null;
  message?: string | null;
  output?: JsonObject;
  progress?: number;
  providerJobId?: string | null;
  stage?: string;
  status?: string;
};

type GenerationAssetRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  generation_job_id: string | null;
  asset_kind: string;
  variant: string | null;
  mime_type: string;
  file_name: string;
  byte_size: number | null;
  r2_key: string;
  metadata_json: string;
  created_at: string;
};

const OPPORTUNITY_PRIORITY_TOKENS = new Set([
  "acquisition",
  "ai",
  "asset",
  "assets",
  "boring",
  "business",
  "businesses",
  "buy",
  "buying",
  "cash",
  "cashflow",
  "deal",
  "deals",
  "ecommerce",
  "franchise",
  "franchises",
  "income",
  "investing",
  "investment",
  "laundromat",
  "operator",
  "operators",
  "estate",
  "saas",
  "service",
  "services",
  "small",
  "storage",
  "strategy",
  "smb",
  "vending",
  "wealth",
]);

const OPPORTUNITY_BUSINESS_TOKENS = new Set([
  "acquisition",
  "asset",
  "assets",
  "boring",
  "business",
  "businesses",
  "buy",
  "buying",
  "cash",
  "cashflow",
  "deal",
  "deals",
  "ecommerce",
  "estate",
  "franchise",
  "franchises",
  "income",
  "investing",
  "investment",
  "laundromat",
  "operator",
  "operators",
  "saas",
  "service",
  "services",
  "small",
  "smb",
  "storage",
  "vending",
  "wealth",
]);

const OPPORTUNITY_STOP_WORDS = new Set([
  "after",
  "almost",
  "around",
  "because",
  "best",
  "being",
  "between",
  "could",
  "does",
  "every",
  "from",
  "have",
  "into",
  "just",
  "most",
  "nobody",
  "over",
  "people",
  "really",
  "should",
  "still",
  "than",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "under",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
]);

const DEFAULT_SCRIPT_LAB_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const AI_SCRIPT_LAB_STEPS = new Set<ScriptLabStep>([
  "hooks",
  "outline",
  "script",
  "director_notes",
  "thumbnail_brief",
]);

type PersonaModelRow = {
  id: string;
  workspace_id: string;
  channel_id: number | null;
  status: string;
  provider: string;
  provider_job_id: string | null;
  base_model: string;
  adapter_path: string | null;
  dataset_path: string | null;
  dataset_examples: number;
  metadata_json: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  channel_slug: string | null;
  channel_name: string | null;
};

type ThumbnailAnalysisRow = {
  thumbnail_provider: string | null;
  thumbnail_model_key: string | null;
  thumbnail_text_overlay: string | null;
  thumbnail_text_overlay_present: number | null;
  thumbnail_text_position: string | null;
  thumbnail_text_size: string | null;
  thumbnail_has_face: number | null;
  thumbnail_face_count: number | null;
  thumbnail_expression: string | null;
  thumbnail_dominant_colors: string | null;
  thumbnail_composition_style: string | null;
  thumbnail_primary_subject: string | null;
  thumbnail_objects_json: string | null;
  thumbnail_visual_hook: string | null;
  thumbnail_why_it_works: string | null;
  thumbnail_clarity_score: number | null;
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
  v.youtube_id,
  v.title,
  v.upload_date,
  v.duration_sec,
  v.view_count,
  v.like_count,
  v.comment_count,
  v.description,
  v.tags,
  v.engagement_rate,
  v.performance_tier,
  ta.provider AS thumbnail_provider,
  ta.model_key AS thumbnail_model_key,
  ta.text_overlay AS thumbnail_text_overlay,
  ta.text_overlay_present AS thumbnail_text_overlay_present,
  ta.text_position AS thumbnail_text_position,
  ta.text_size AS thumbnail_text_size,
  ta.has_face AS thumbnail_has_face,
  ta.face_count AS thumbnail_face_count,
  ta.expression AS thumbnail_expression,
  ta.dominant_colors AS thumbnail_dominant_colors,
  ta.composition_style AS thumbnail_composition_style,
  ta.primary_subject AS thumbnail_primary_subject,
  ta.objects_json AS thumbnail_objects_json,
  ta.visual_hook AS thumbnail_visual_hook,
  ta.why_it_works AS thumbnail_why_it_works,
  ta.clarity_score AS thumbnail_clarity_score
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

const SCRIPT_PROJECT_SELECT = `
  sp.id,
  sp.workspace_id,
  sp.channel_id,
  sp.persona_model_id,
  sp.opportunity_json,
  sp.title,
  sp.topic,
  sp.status,
  sp.created_by_user_id,
  sp.created_at,
  sp.updated_at,
  c.slug AS channel_slug,
  c.channel_name AS channel_name,
  (
    SELECT COUNT(*)
    FROM script_research_items sri
    WHERE sri.project_id = sp.id
  ) AS research_item_count,
  (
    SELECT so.step
    FROM script_outputs so
    WHERE so.project_id = sp.id
    ORDER BY so.created_at DESC
    LIMIT 1
  ) AS latest_output_step,
  (
    SELECT so.version
    FROM script_outputs so
    WHERE so.project_id = sp.id
    ORDER BY so.created_at DESC
    LIMIT 1
  ) AS latest_output_version
`;

const SCRIPT_RESEARCH_SELECT = `
  id,
  project_id,
  item_type,
  source_channel_slug,
  source_youtube_id,
  source_vector_id,
  title,
  excerpt,
  score,
  metadata_json,
  created_at
`;

const SCRIPT_OUTPUT_SELECT = `
  id,
  project_id,
  step,
  version,
  model_key,
  content,
  metadata_json,
  created_by_user_id,
  created_at
`;

const THUMBNAIL_BRIEF_SELECT = `
  id,
  project_id,
  version,
  content,
  metadata_json,
  created_at
`;

const GENERATION_JOB_SELECT = `
  id,
  workspace_id,
  project_id,
  persona_model_id,
  job_type,
  provider,
  provider_job_id,
  status,
  stage,
  progress,
  input_json,
  output_json,
  message,
  error_message,
  created_by_user_id,
  lease_token,
  lease_expires_at,
  started_at,
  completed_at,
  created_at,
  updated_at
`;

const GENERATION_ASSET_SELECT = `
  id,
  workspace_id,
  project_id,
  generation_job_id,
  asset_kind,
  variant,
  mime_type,
  file_name,
  byte_size,
  r2_key,
  metadata_json,
  created_at
`;

const PERSONA_MODEL_SELECT = `
  pm.id,
  pm.workspace_id,
  pm.channel_id,
  pm.status,
  pm.provider,
  pm.provider_job_id,
  pm.base_model,
  pm.adapter_path,
  pm.dataset_path,
  pm.dataset_examples,
  pm.metadata_json,
  pm.created_by_user_id,
  pm.created_at,
  pm.updated_at,
  c.slug AS channel_slug,
  c.channel_name AS channel_name
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
      return withCors(await createAuth(env, request).handler(request), request, env);
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

    if (parts[0] === "api" && parts[1] === "callback") {
      return withCors(await handleCallbackRoute(request, parts, env), request, env);
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

    if (parts[0] === "api" && parts[1] === "script-lab") {
      return withCors(await handleScriptLabRoute(parts, request, context, env), request, env);
    }

    if (parts[0] === "api" && parts[1] === "persona-models") {
      return withCors(await handlePersonaModelsRoute(parts, request, context, env), request, env);
    }

    if (parts[0] === "api" && parts[1] === "generation-jobs" && parts[2] && request.method === "GET") {
      return withCors(await getGenerationJob(parts[2], context, env), request, env);
    }

    if (parts[0] === "api" && parts[1] === "assets" && parts[2] && request.method === "GET") {
      return withCors(await getGenerationAsset(parts[2], context, env), request, env);
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

function extractAiTextResponse(response: unknown): string | null {
  const payload: any = response;

  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  if (typeof payload?.response === "string" && payload.response.trim().length > 0) {
    return payload.response.trim();
  }

  if (typeof payload?.result?.response === "string" && payload.result.response.trim().length > 0) {
    return payload.result.response.trim();
  }

  if (Array.isArray(payload?.result) && payload.result.length > 0) {
    const combined = payload.result
      .map((item: any) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        if (Array.isArray(item?.content)) {
          return item.content
            .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
            .join("");
        }
        return "";
      })
      .join("")
      .trim();

    if (combined) return combined;
  }

  if (Array.isArray(payload?.output) && payload.output.length > 0) {
    const combined = payload.output
      .map((item: any) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        if (Array.isArray(item?.content)) {
          return item.content
            .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
            .join("");
        }
        return "";
      })
      .join("")
      .trim();

    if (combined) return combined;
  }

  const choiceContent = payload?.choices?.[0]?.message?.content;
  if (typeof choiceContent === "string" && choiceContent.trim().length > 0) {
    return choiceContent.trim();
  }
  if (Array.isArray(choiceContent)) {
    const combined = choiceContent
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (combined) return combined;
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

  if (parts[2] === "scan-jobs") {
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

  if (parts[2] === "generation-jobs") {
    if (parts.length === 3 && request.method === "POST") {
      return leaseGenerationJob(request, env);
    }

    if (!parts[3]) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    const jobId = decodeURIComponent(parts[3]);
    const action = parts[4];

    if (request.method === "POST") {
      if (action === "heartbeat") return heartbeatGenerationJob(jobId, request, env);
      if (action === "progress") return patchGenerationJob(jobId, request, env);
      if (action === "complete") return completeGenerationJob(jobId, request, env);
      if (action === "fail") return failGenerationJob(jobId, request, env);
      if (action === "assets") return uploadGenerationAsset(jobId, request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  }

  if (parts[2] !== "scan-jobs") {
    return jsonResponse({ error: "Not found" }, 404);
  }

  return jsonResponse({ error: "Not found" }, 404);
}

function readCallbackLeaseToken(
  request: Request,
  searchParams?: URLSearchParams,
  fallback?: unknown
): string {
  const headerToken =
    request.headers.get("x-generation-lease-token")?.trim() ||
    request.headers.get("x-lease-token")?.trim();
  if (headerToken) return headerToken;

  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }

  return searchParams?.get("leaseToken")?.trim() || "";
}

async function fetchCallbackGenerationJob(
  jobId: string,
  leaseToken: string,
  env: Env
): Promise<InternalGenerationJobRow | null> {
  if (!leaseToken) return null;
  const job = await fetchInternalGenerationJob(jobId, env);
  if (!job || job.lease_token !== leaseToken) return null;
  return job;
}

async function handleCallbackRoute(
  request: Request,
  parts: string[],
  env: Env
): Promise<Response> {
  if (parts[2] !== "generation-jobs" || !parts[3]) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const jobId = decodeURIComponent(parts[3]);
  const action = parts[4];

  if (request.method === "GET" && action === "dataset") {
    return getGenerationJobDataset(jobId, request, env);
  }

  if (request.method === "POST") {
    if (action === "progress") return patchGenerationJobCallback(jobId, request, env);
    if (action === "complete") return completeGenerationJobCallback(jobId, request, env);
    if (action === "fail") return failGenerationJobCallback(jobId, request, env);
    if (action === "assets") return uploadGenerationAssetCallback(jobId, request, env);
  }

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
  const now = new Date().toISOString();
  const leaseableWhere = `
    (
      status = 'queued'
      OR (
        status = 'running'
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at < ?
      )
    )
  `;

  const row = requestedJobId
    ? await env.DB.prepare(
        `SELECT ${INTERNAL_SCAN_JOB_SELECT} FROM scan_jobs WHERE id = ? AND ${leaseableWhere} LIMIT 1`
      )
        .bind(requestedJobId, now)
        .first<InternalScanJobRow>()
    : await env.DB.prepare(
        `SELECT ${INTERNAL_SCAN_JOB_SELECT} FROM scan_jobs WHERE ${leaseableWhere} ORDER BY CASE WHEN status = 'queued' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`
      )
        .bind(now)
        .first<InternalScanJobRow>();

  if (!row) {
    return jsonResponse({ job: null });
  }

  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const leaseUpdate = await env.DB.prepare(
    `
      UPDATE scan_jobs
      SET
        status = 'running',
        lease_token = ?,
        lease_expires_at = ?,
        started_at = COALESCE(started_at, ?),
        updated_at = ?
      WHERE id = ?
        AND (
          status = 'queued'
          OR (
            status = 'running'
            AND lease_expires_at IS NOT NULL
            AND lease_expires_at < ?
          )
        )
    `
  )
    .bind(leaseToken, leaseExpiresAt, now, now, row.id, now)
    .run();

  if (!leaseUpdate.meta.changes) {
    return jsonResponse({ job: null });
  }

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

async function fetchInternalGenerationJob(
  jobId: string,
  env: Env
): Promise<InternalGenerationJobRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${GENERATION_JOB_SELECT} FROM generation_jobs WHERE id = ? LIMIT 1`
  )
    .bind(jobId)
    .first<InternalGenerationJobRow>();

  return row ?? null;
}

async function fetchLatestGenerationAssetByKind(
  jobId: string,
  assetKind: string,
  env: Env
): Promise<GenerationAssetRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${GENERATION_ASSET_SELECT} FROM generation_assets WHERE generation_job_id = ? AND asset_kind = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(jobId, assetKind)
    .first<GenerationAssetRow>();

  return row ?? null;
}

async function syncPersonaModelFromGenerationJob(
  job: InternalGenerationJobRow,
  targetStatus: "ready" | "failed",
  env: Env
): Promise<void> {
  if (!job.persona_model_id) return;

  const personaRow = await env.DB.prepare(
    `SELECT id, metadata_json, adapter_path FROM persona_models WHERE id = ? LIMIT 1`
  )
    .bind(job.persona_model_id)
    .first<{ id: string; metadata_json: string; adapter_path: string | null }>();

  if (!personaRow) return;

  const now = new Date().toISOString();
  const existingMetadata = parseJsonObject(personaRow.metadata_json);
  const output = parseJsonObject(job.output_json);
  const adapterAsset =
    targetStatus === "ready"
      ? await fetchLatestGenerationAssetByKind(job.id, "persona_adapter", env)
      : null;
  const metricsAsset = await fetchLatestGenerationAssetByKind(job.id, "persona_metrics", env);
  const nextMetadata = {
    ...existingMetadata,
    lastTrainingCompletedAt: now,
    lastTrainingError:
      targetStatus === "failed" ? compactMessage(job.error_message ?? job.message) : null,
    lastTrainingJobId: job.id,
    lastTrainingOutput: output,
    styleSamples:
      targetStatus === "ready" && Array.isArray(output.styleSamples) ? output.styleSamples : null,
    latestAdapterAssetId: adapterAsset?.id ?? null,
    latestMetricsAssetId: metricsAsset?.id ?? null,
  };

  await env.DB.prepare(
    `
      UPDATE persona_models
      SET
        status = ?,
        provider_job_id = ?,
        adapter_path = ?,
        metadata_json = ?,
        updated_at = ?
      WHERE id = ?
    `
  )
    .bind(
      targetStatus,
      job.provider_job_id,
      targetStatus === "ready" && adapterAsset ? `assets://${adapterAsset.r2_key}` : personaRow.adapter_path,
      JSON.stringify(nextMetadata),
      now,
      job.persona_model_id
    )
    .run();

  if (job.provider_job_id) {
    try {
      await terminateLambdaInstances(env, [job.provider_job_id]);
    } catch (error) {
      console.warn(`Failed to terminate Lambda instance ${job.provider_job_id}:`, error);
    }
  }
}

async function recordGenerationJobEvent(
  jobId: string,
  row: Partial<InternalGenerationJobRow>,
  metadata: Record<string, unknown>,
  env: Env
): Promise<void> {
  const now = new Date().toISOString();

  await env.DB.prepare(
    `
      INSERT INTO generation_job_events (
        id,
        generation_job_id,
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

async function leaseGenerationJob(request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const requestedJobId = String(payload?.jobId ?? "").trim() || null;
  const providerFilter = Array.isArray(payload?.providers)
    ? payload.providers.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const jobTypeFilter = Array.isArray(payload?.jobTypes)
    ? payload.jobTypes.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const now = new Date().toISOString();
  const leaseableWhere = `
    (
      status = 'queued'
      OR (
        status = 'running'
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at < ?
      )
    )
  `;
  const filterClauses: string[] = [];
  const filterBinds: unknown[] = [];

  if (providerFilter.length) {
    filterClauses.push(`provider IN (${providerFilter.map(() => "?").join(", ")})`);
    filterBinds.push(...providerFilter);
  }

  if (jobTypeFilter.length) {
    filterClauses.push(`job_type IN (${jobTypeFilter.map(() => "?").join(", ")})`);
    filterBinds.push(...jobTypeFilter);
  }

  const filterSql = filterClauses.length ? ` AND ${filterClauses.join(" AND ")}` : "";

  const row = requestedJobId
    ? await env.DB.prepare(
        `SELECT ${GENERATION_JOB_SELECT} FROM generation_jobs WHERE id = ? AND ${leaseableWhere}${filterSql} LIMIT 1`
      )
        .bind(requestedJobId, now, ...filterBinds)
        .first<InternalGenerationJobRow>()
    : await env.DB.prepare(
        `SELECT ${GENERATION_JOB_SELECT} FROM generation_jobs WHERE ${leaseableWhere}${filterSql} ORDER BY CASE WHEN status = 'queued' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`
      )
        .bind(now, ...filterBinds)
        .first<InternalGenerationJobRow>();

  if (!row) {
    return jsonResponse({ job: null });
  }

  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const result = await env.DB.prepare(
    `
      UPDATE generation_jobs
      SET
        status = 'running',
        stage = CASE WHEN stage = 'queued' THEN 'starting' ELSE stage END,
        lease_token = ?,
        lease_expires_at = ?,
        started_at = COALESCE(started_at, ?),
        updated_at = ?
      WHERE id = ?
        AND (
          status = 'queued'
          OR (
            status = 'running'
            AND lease_expires_at IS NOT NULL
            AND lease_expires_at < ?
          )
        )
    `
  )
    .bind(leaseToken, leaseExpiresAt, now, now, row.id, now)
    .run();

  if (!result.meta.changes) {
    return jsonResponse({ job: null });
  }

  const leased = await fetchInternalGenerationJob(row.id, env);
  if (!leased) return jsonResponse({ job: null });

  await recordGenerationJobEvent(
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
      ...toGenerationJobSummary(leased),
      leaseToken,
    },
  });
}

async function heartbeatGenerationJob(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const leaseToken = readCallbackLeaseToken(request, undefined, payload?.leaseToken);

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  const row = await fetchInternalGenerationJob(jobId, env);
  if (!row) return jsonResponse({ error: "Generation job not found" }, 404);
  if (row.lease_token !== leaseToken) {
    return jsonResponse({ error: "Lease token mismatch" }, 409);
  }

  const now = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `UPDATE generation_jobs SET lease_expires_at = ?, updated_at = ? WHERE id = ? AND lease_token = ?`
  )
    .bind(leaseExpiresAt, now, jobId, leaseToken)
    .run();

  return jsonResponse({
    job: {
      ...toGenerationJobSummary({
        ...row,
        lease_expires_at: leaseExpiresAt,
        updated_at: now,
      }),
      leaseToken,
    },
  });
}

async function updateInternalGenerationJob(
  jobId: string,
  leaseToken: string,
  patch: InternalGenerationJobPatch,
  env: Env
): Promise<InternalGenerationJobRow | null> {
  const row = await fetchInternalGenerationJob(jobId, env);
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

  if (patch.message !== undefined) {
    assignments.push("message = ?");
    binds.push(compactMessage(patch.message));
  }

  if (patch.providerJobId !== undefined) {
    assignments.push("provider_job_id = ?");
    binds.push(patch.providerJobId);
  }

  if (patch.output !== undefined) {
    assignments.push("output_json = ?");
    binds.push(JSON.stringify(patch.output));
  }

  binds.push(jobId, leaseToken);

  await env.DB.prepare(
    `UPDATE generation_jobs SET ${assignments.join(", ")} WHERE id = ? AND lease_token = ?`
  )
    .bind(...binds)
    .run();

  const updated = await fetchInternalGenerationJob(jobId, env);
  if (!updated) return null;

  await recordGenerationJobEvent(
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

async function patchGenerationJob(jobId: string, request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const leaseToken = readCallbackLeaseToken(request, undefined, payload?.leaseToken);

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  try {
    const updated = await updateInternalGenerationJob(
      jobId,
      leaseToken,
      {
        message:
          payload?.message === undefined || payload?.message === null
            ? undefined
            : String(payload.message),
        errorMessage:
          payload?.errorMessage === undefined || payload?.errorMessage === null
            ? undefined
            : String(payload.errorMessage),
        output:
          payload?.output === undefined || payload?.output === null
            ? undefined
            : (payload.output as JsonObject),
        progress:
          payload?.progress === undefined || payload?.progress === null
            ? undefined
            : Number(payload.progress),
        providerJobId:
          payload?.providerJobId === undefined || payload?.providerJobId === null
            ? undefined
            : String(payload.providerJobId),
        stage:
          payload?.stage === undefined || payload?.stage === null
            ? undefined
            : String(payload.stage),
        status:
          payload?.status === undefined || payload?.status === null
            ? undefined
            : String(payload.status),
      },
      env
    );

    if (!updated) return jsonResponse({ error: "Generation job not found" }, 404);
    return jsonResponse({ job: { ...toGenerationJobSummary(updated), leaseToken } });
  } catch (error) {
    if (error instanceof Error && error.message === "Lease token mismatch") {
      return jsonResponse({ error: error.message }, 409);
    }

    throw error;
  }
}

async function completeGenerationJob(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const leaseToken = readCallbackLeaseToken(request, undefined, payload?.leaseToken);

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  const updated = await updateInternalGenerationJob(
    jobId,
    leaseToken,
    {
      message:
        payload?.message === undefined || payload?.message === null
          ? "Completed generation job"
          : String(payload.message),
      output:
        payload?.output === undefined || payload?.output === null
          ? undefined
          : (payload.output as JsonObject),
      progress: 1,
      providerJobId:
        payload?.providerJobId === undefined || payload?.providerJobId === null
          ? undefined
          : String(payload.providerJobId),
      stage: payload?.stage ? String(payload.stage) : "completed",
      status: "completed",
    },
    env
  );

  if (!updated) return jsonResponse({ error: "Generation job not found" }, 404);

  const completedAt = new Date().toISOString();
  await env.DB.prepare(
    `
      UPDATE generation_jobs
      SET lease_token = NULL, lease_expires_at = NULL, completed_at = ?, updated_at = ?
      WHERE id = ?
    `
  )
    .bind(completedAt, completedAt, jobId)
    .run();

  const completed = await fetchInternalGenerationJob(jobId, env);
  if ((completed ?? updated).job_type === "persona_train") {
    await syncPersonaModelFromGenerationJob(completed ?? updated, "ready", env);
  }
  return jsonResponse({ job: { ...toGenerationJobSummary(completed ?? updated), leaseToken: null } });
}

async function failGenerationJob(jobId: string, request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const leaseToken = readCallbackLeaseToken(request, undefined, payload?.leaseToken);

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  const updated = await updateInternalGenerationJob(
    jobId,
    leaseToken,
    {
      message:
        payload?.message === undefined || payload?.message === null
          ? "Generation job failed"
          : String(payload.message),
      errorMessage:
        payload?.message === undefined || payload?.message === null
          ? "Generation job failed"
          : String(payload.message),
      output:
        payload?.output === undefined || payload?.output === null
          ? undefined
          : (payload.output as JsonObject),
      progress:
        payload?.progress === undefined || payload?.progress === null
          ? undefined
          : Number(payload.progress),
      providerJobId:
        payload?.providerJobId === undefined || payload?.providerJobId === null
          ? undefined
          : String(payload.providerJobId),
      stage: payload?.stage ? String(payload.stage) : "failed",
      status: "failed",
    },
    env
  );

  if (!updated) return jsonResponse({ error: "Generation job not found" }, 404);

  const completedAt = new Date().toISOString();
  await env.DB.prepare(
    `
      UPDATE generation_jobs
      SET lease_token = NULL, lease_expires_at = NULL, completed_at = ?, updated_at = ?
      WHERE id = ?
    `
  )
    .bind(completedAt, completedAt, jobId)
    .run();

  const failed = await fetchInternalGenerationJob(jobId, env);
  if ((failed ?? updated).job_type === "persona_train") {
    await syncPersonaModelFromGenerationJob(failed ?? updated, "failed", env);
  }
  return jsonResponse({ job: { ...toGenerationJobSummary(failed ?? updated), leaseToken: null } });
}

function sanitizeAssetFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "asset.bin";
}

async function uploadGenerationAsset(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.ASSETS) {
    return jsonResponse({ error: "ASSETS bucket binding is not configured" }, 500);
  }

  const formData = await request.formData();
  const leaseToken = readCallbackLeaseToken(request, undefined, formData.get("leaseToken"));
  const assetKind = String(formData.get("assetKind") ?? "").trim();
  const fileName = sanitizeAssetFileName(String(formData.get("fileName") ?? ""));
  const mimeType = String(formData.get("mimeType") ?? "").trim() || "application/octet-stream";
  const variant = String(formData.get("variant") ?? "").trim() || null;
  const metadataValue = String(formData.get("metadata") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim() || null;
  const file = formData.get("file") as Blob | string | null;

  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  if (!assetKind) {
    return jsonResponse({ error: "assetKind is required" }, 400);
  }

  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return jsonResponse({ error: "file is required" }, 400);
  }

  const job = await fetchInternalGenerationJob(jobId, env);
  if (!job) return jsonResponse({ error: "Generation job not found" }, 404);
  if (job.lease_token !== leaseToken) {
    return jsonResponse({ error: "Lease token mismatch" }, 409);
  }

  const metadata = metadataValue ? parseJsonObject(metadataValue) : {};
  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();
  const byteSize = file.size || null;
  const finalProjectId = projectId ?? job.project_id;
  const r2Key = [
    "generated",
    job.workspace_id,
    finalProjectId ?? "unscoped",
    jobId,
    `${assetId}-${fileName}`,
  ].join("/");

  await env.ASSETS.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: mimeType,
    },
  });

  await env.DB.prepare(
    `
      INSERT INTO generation_assets (
        id,
        workspace_id,
        project_id,
        generation_job_id,
        asset_kind,
        variant,
        mime_type,
        file_name,
        byte_size,
        r2_key,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      assetId,
      job.workspace_id,
      finalProjectId,
      jobId,
      assetKind,
      variant,
      mimeType,
      fileName,
      byteSize,
      r2Key,
      JSON.stringify(metadata),
      now
    )
    .run();

  const row = await env.DB.prepare(
    `SELECT ${GENERATION_ASSET_SELECT} FROM generation_assets WHERE id = ? LIMIT 1`
  )
    .bind(assetId)
    .first<GenerationAssetRow>();

  if (!row) {
    return jsonResponse({ error: "Failed to persist asset" }, 500);
  }

  await recordGenerationJobEvent(
    jobId,
    {
      message: `Uploaded ${assetKind} asset`,
      progress: job.progress,
      stage: job.stage,
      status: job.status,
    },
    { assetId, assetKind, variant, r2Key },
    env
  );

  return jsonResponse({ asset: toGenerationAssetSummary(row) });
}

async function getGenerationJobDataset(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.ASSETS) {
    return jsonResponse({ error: "ASSETS bucket binding is not configured" }, 500);
  }

  const url = new URL(request.url);
  const leaseToken = readCallbackLeaseToken(request, url.searchParams);
  if (!leaseToken) {
    return jsonResponse({ error: "leaseToken is required" }, 400);
  }

  const job = await fetchCallbackGenerationJob(jobId, leaseToken, env);
  if (!job) {
    return jsonResponse({ error: "Generation job not found" }, 404);
  }

  if (job.job_type !== "persona_train") {
    return jsonResponse({ error: "Dataset download is only available for persona training jobs" }, 400);
  }

  const input = parseJsonObject(job.input_json);
  const datasetPath = typeof input.datasetPath === "string" ? input.datasetPath.trim() : "";
  if (!datasetPath.startsWith("assets://")) {
    return jsonResponse({ error: "Dataset asset is unavailable" }, 404);
  }

  const object = await env.ASSETS.get(datasetPath.slice("assets://".length));
  if (!object) {
    return jsonResponse({ error: "Dataset blob not found" }, 404);
  }

  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/x-ndjson; charset=utf-8",
  });

  return new Response(object.body, {
    headers,
    status: 200,
  });
}

async function patchGenerationJobCallback(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  return patchGenerationJob(jobId, request, env);
}

async function completeGenerationJobCallback(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  return completeGenerationJob(jobId, request, env);
}

async function failGenerationJobCallback(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  return failGenerationJob(jobId, request, env);
}

async function uploadGenerationAssetCallback(
  jobId: string,
  request: Request,
  env: Env
): Promise<Response> {
  return uploadGenerationAsset(jobId, request, env);
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

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildTextSearchTerms(query: string): string[] {
  const normalized = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const terms = [...new Set(normalized.split(" ").filter((term) => term.length >= 4))].slice(0, 6);
  return terms.length > 0 ? terms : [normalized.slice(0, 64)];
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
  if (parts[3] === "opportunities") return getChannelOpportunities(slug, context, env);
  if (parts[3] === "videos") return getChannelVideos(slug, url, context, env);
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

async function getChannelVideos(
  slug: string,
  url: URL,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const analytics = await getChannelAnalytics(slug, context, env);
  if (!analytics) return jsonResponse({ error: "Channel not found" }, 404);

  const sort = url.searchParams.get("sort") === "views" ? "views" : "recent";
  const limit = clampLimit(url.searchParams.get("limit"), 30, 250);
  const items = [...analytics.videos]
    .sort((left, right) => {
      if (sort === "views" && right.viewCount !== left.viewCount) {
        return right.viewCount - left.viewCount;
      }

      const dateDelta = right.uploadDate.localeCompare(left.uploadDate);
      if (dateDelta !== 0) return dateDelta;
      return right.viewCount - left.viewCount;
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
      thumbnailAnalysis: video.thumbnailAnalysis,
    }));

  const response: ChannelVideosResponse = {
    channel: slug,
    items,
    count: items.length,
    sort,
  };

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

function getOpportunityPriorityBoost(tokens: string[]): number {
  return tokens.reduce((sum, token) => {
    if (OPPORTUNITY_PRIORITY_TOKENS.has(token)) return sum + 5;
    return sum;
  }, 0);
}

function getOpportunityBusinessFitScore(tokens: string[]): number {
  return tokens.reduce((sum, token) => {
    if (OPPORTUNITY_BUSINESS_TOKENS.has(token)) return sum + 1;
    return sum;
  }, 0);
}

function isBusinessAdjacentOpportunity(tokens: string[]): boolean {
  return getOpportunityBusinessFitScore(tokens) > 0;
}

function buildOpportunityMetricLabel(views: number, videoCount?: number): string {
  const base = `${Math.round(views).toLocaleString()} avg views`;
  if (!videoCount) return base;
  return `${base} across ${videoCount} videos`;
}

function findAnalyticsVideo(
  analytics: ChannelAnalytics,
  youtubeId: string | null | undefined
): AnalyticsVideo | null {
  if (!youtubeId) return null;
  return analytics.videos.find((video) => video.youtubeId === youtubeId) ?? null;
}

function buildThumbnailDirection(video: AnalyticsVideo | null): string {
  const analysis = video?.thumbnailAnalysis;
  if (!analysis) {
    return "Use one bold subject, a short 2-4 word claim, and high contrast so the idea reads instantly on mobile.";
  }

  const notes = [
    analysis.primarySubject ? `Keep ${analysis.primarySubject} as the dominant subject.` : null,
    analysis.textOverlayPresent
      ? `Use ${analysis.textSize} ${analysis.textPosition} text, similar to the channel's winners.`
      : "Favor short, punchy overlay text with a single dominant claim.",
    analysis.expression ? `Match the ${analysis.expression} expression or reaction energy.` : null,
    analysis.visualHook ? `Center the composition around ${analysis.visualHook}.` : null,
  ].filter((value): value is string => Boolean(value));

  return notes[0] ?? "Lead with a single visual argument and avoid clutter.";
}

function buildRepeatWinnerCandidate(
  analytics: ChannelAnalytics,
  cluster: ChannelAnalytics["topicClusters"][number]
): OpportunityCandidate {
  const exemplarVideo = findAnalyticsVideo(analytics, cluster.topVideoYoutubeId);
  const topicTokens = tokenizeOpportunityText(cluster.topic);
  const score = clampOpportunityScore(
    58 +
      Math.min(18, (cluster.averageViews / Math.max(analytics.averageViews, 1)) * 14) +
      Math.min(10, cluster.videoCount * 2) +
      Math.min(9, cluster.shareOfChannel * 100 * 0.35) +
      getOpportunityPriorityBoost(topicTokens)
  );

  return {
    id: `${analytics.channel.slug}-repeat-${slugifyValue(cluster.topic)}`,
    opportunityType: "repeat_winner",
    title: `Double down on ${cluster.topic}`,
    topic: cluster.topic,
    angle: `Take ${cluster.topic} out of generic listicle mode and frame it as a concrete operator play with one decisive business lesson.`,
    rationale: `${analytics.channel.channel_name} already wins in this lane. The goal is not to repeat the same topic, but to narrow it into a sharper business-buying angle.`,
    whyNow: `This is already proven on the channel, so it gives you the safest path to a new winner while still feeling fresh if the framing gets more specific.`,
    recommendedHook: `${cluster.topic} looks crowded until you realize the real money is in the part almost nobody breaks down clearly.`,
    recommendedFormat: "Evidence-led explainer with operator examples",
    recommendedDuration: analytics.stats.bestDuration?.label ?? "12-18 min",
    thumbnailDirection: buildThumbnailDirection(exemplarVideo),
    score,
    channelEvidence: [
      {
        title: "Existing win on your channel",
        detail: cluster.topVideoTitle,
        supportingMetric: `${cluster.topVideoViewCount.toLocaleString()} views`,
        href: cluster.exemplarVideoUrl,
      },
      {
        title: "Repeatable topic cluster",
        detail: `${cluster.topic} is already a durable lane on the channel.`,
        supportingMetric: buildOpportunityMetricLabel(cluster.averageViews, cluster.videoCount),
        href: cluster.exemplarVideoUrl,
      },
      {
        title: "Share of channel mix",
        detail: `${Math.round(cluster.shareOfChannel * 100)}% of uploads already sit in this topic family.`,
        supportingMetric: null,
        href: null,
      },
    ],
    competitorEvidence: [],
    packageSeed: {
      title: `The smartest ${cluster.topic.toLowerCase()} play in 2026`,
      topic: cluster.topic,
    },
  };
}

function buildWhitespaceCandidate(
  analytics: ChannelAnalytics,
  gap: {
    topic: string;
    sourceChannel: string;
    videoCount: number;
    averageViews: number;
    opportunityScore: number;
    exemplarTitle: string;
    exemplarYoutubeId: string;
    exemplarVideoUrl: string;
  }
): OpportunityCandidate {
  const topicTokens = tokenizeOpportunityText(gap.topic);
  const businessFit = getOpportunityBusinessFitScore(topicTokens);
  const score = clampOpportunityScore(
    62 +
      Math.min(16, gap.averageViews / Math.max(analytics.averageViews, 1) * 10) +
      Math.min(10, gap.videoCount * 2) +
      getOpportunityPriorityBoost(topicTokens) +
      businessFit * 4
  );

  return {
    id: `${analytics.channel.slug}-whitespace-${slugifyValue(gap.topic)}`,
    opportunityType: "adjacent_whitespace",
    title: `Own ${gap.topic} with a business-buying angle`,
    topic: gap.topic,
    angle: `Borrow the curiosity already present around ${gap.topic}, but reinterpret it through ownership, cash flow, or strategic advantage instead of generic commentary.`,
    rationale: `${gap.sourceChannel} is proving viewer appetite here, and ${analytics.channel.channel_name} has not clearly claimed this angle yet.`,
    whyNow: `This is the fastest way to differentiate without leaving the audience's core interests. It feels new to your channel but already validated in the category.`,
    recommendedHook: `Everybody is talking about ${gap.topic} like a headline. The better question is where the real business leverage is hiding.`,
    recommendedFormat: "Johnny Harris-style narrative business explainer",
    recommendedDuration: analytics.stats.bestDuration?.label ?? "12-18 min",
    thumbnailDirection:
      "Use one recognizable object from the story, a blunt 2-4 word claim, and a simple before-vs-after frame.",
    score,
    channelEvidence: [
      {
        title: "Fits your audience",
        detail: `${analytics.channel.channel_name} already over-indexes on practical wealth and business education angles.`,
        supportingMetric: `${analytics.averageViews.toLocaleString()} channel avg views`,
        href: null,
      },
    ],
    competitorEvidence: [
      {
        title: `${gap.sourceChannel} proves demand`,
        detail: gap.exemplarTitle,
        supportingMetric: buildOpportunityMetricLabel(gap.averageViews, gap.videoCount),
        href: gap.exemplarVideoUrl,
      },
    ],
    packageSeed: {
      title: `The hidden business angle inside ${gap.topic}`,
      topic: gap.topic,
    },
  };
}

function buildContrarianCandidate(
  analytics: ChannelAnalytics,
  anchorCluster: ChannelAnalytics["topicClusters"][number] | null,
  topHook: HookSummary | null
): OpportunityCandidate | null {
  const cluster = anchorCluster;
  if (!cluster?.topic) return null;
  const topic = cluster.topic;

  const score = clampOpportunityScore(
    66 +
      Math.min(12, (cluster.averageViews / Math.max(analytics.averageViews, 1)) * 8) +
      getOpportunityPriorityBoost(tokenizeOpportunityText(topic))
  );

  const recommendedHook =
    topHook?.hookType === "shock"
      ? `The internet keeps romanticizing ${topic}. The real opportunity is much less obvious and a lot more profitable.`
      : `Most people think ${topic} wins because it looks hot. It wins when it looks boring, messy, and hard to copy.`;

  return {
    id: `${analytics.channel.slug}-contrarian-${slugifyValue(topic)}`,
    opportunityType: "contrarian_take",
    title: `The contrarian ${topic.toLowerCase()} play nobody is modeling correctly`,
    topic,
    angle: `Position ${topic} as an asymmetric bet: less glamour, more operator edge. The story should challenge what ambitious viewers assume the best opportunities look like.`,
    rationale: `Contrarian framing is part of the channel promise, but it works best when attached to a lane that is already validated on the channel.`,
    whyNow: `This lets ${analytics.channel.channel_name} stay on-brand while sounding materially fresher than another standard “best businesses” roundup.`,
    recommendedHook,
    recommendedFormat: "Contrarian breakdown with hard proof points",
    recommendedDuration: analytics.stats.bestDuration?.label ?? "12-18 min",
    thumbnailDirection:
      "Use one plain-looking business visual, a skeptical face or reaction, and a short line that implies the obvious answer is wrong.",
    score,
    channelEvidence: [
      {
        title: "Validated lane",
        detail: cluster.topVideoTitle,
        supportingMetric: `${cluster.topVideoViewCount.toLocaleString()} views`,
        href: cluster.exemplarVideoUrl,
      },
      {
        title: "Works with the brand",
        detail: `${analytics.channel.channel_name} performs best when the angle feels useful, surprising, and slightly anti-consensus.`,
        supportingMetric: null,
        href: null,
      },
    ],
    competitorEvidence: [],
    packageSeed: {
      title: `Why everyone is wrong about ${topic.toLowerCase()} in 2026`,
      topic,
    },
  };
}

function dedupeOpportunityCandidates(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  const seen = new Set<string>();
  const items: OpportunityCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.opportunityType}:${slugifyValue(candidate.topic)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(candidate);
  }

  return items;
}

async function getChannelOpportunities(
  slug: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const analytics = await getChannelAnalytics(slug, context, env);
  if (!analytics) return jsonResponse({ error: "Channel not found" }, 404);

  const [topHooks, workspaceChannels] = await Promise.all([
    fetchHooks(analytics.channel.id, env, { limit: 6, sort: "views" }),
    listWorkspaceChannelRows(context, env),
  ]);

  const repeatCandidates = [...analytics.topicClusters]
    .sort((left, right) => {
      const leftScore =
        left.averageViews / Math.max(analytics.averageViews, 1) +
        left.shareOfChannel +
        left.videoCount * 0.08;
      const rightScore =
        right.averageViews / Math.max(analytics.averageViews, 1) +
        right.shareOfChannel +
        right.videoCount * 0.08;
      return rightScore - leftScore;
    })
    .slice(0, 2)
    .map((cluster) => buildRepeatWinnerCandidate(analytics, cluster));

  const gapCandidates: OpportunityCandidate[] = [];
  const competitorRows = workspaceChannels.filter((channel) => channel.slug !== slug);
  const channelTopics = new Set(analytics.topicClusters.map((cluster) => cluster.topic.toLowerCase()));

  for (const competitor of competitorRows) {
    const competitorAnalytics = await getChannelAnalytics(competitor.slug, context, env);
    if (!competitorAnalytics) continue;

    const comparison = buildComparison(
      {
        slug: analytics.channel.slug,
        channelName: analytics.channel.channel_name,
        totalVideos: analytics.videos.length,
        averageViews: analytics.averageViews,
        medianViews: analytics.medianViews,
        averageEngagementRate: analytics.averageEngagementRate,
        uploadCadencePerWeek: analytics.stats.uploadCadencePerWeek.current,
        bestDuration: analytics.stats.bestDuration,
        topicClusters: analytics.topicClusters,
      },
      {
        slug: competitorAnalytics.channel.slug,
        channelName: competitorAnalytics.channel.channel_name,
        totalVideos: competitorAnalytics.videos.length,
        averageViews: competitorAnalytics.averageViews,
        medianViews: competitorAnalytics.medianViews,
        averageEngagementRate: competitorAnalytics.averageEngagementRate,
        uploadCadencePerWeek: competitorAnalytics.stats.uploadCadencePerWeek.current,
        bestDuration: competitorAnalytics.stats.bestDuration,
        topicClusters: competitorAnalytics.topicClusters,
      }
    );

    const usefulGaps = comparison.topicGaps.filter((gap) => {
      if (gap.missingOn !== analytics.channel.slug) return false;
      if (channelTopics.has(gap.topic.toLowerCase())) return false;
      const tokens = tokenizeOpportunityText(gap.topic);
      if (tokens.length === 0) return false;
      return isBusinessAdjacentOpportunity(tokens);
    });

    gapCandidates.push(...usefulGaps.slice(0, 2).map((gap) => buildWhitespaceCandidate(analytics, gap)));
  }

  const contrarianCandidate = buildContrarianCandidate(
    analytics,
    analytics.topicClusters[0] ?? null,
    topHooks[0] ?? null
  );

  const candidates = dedupeOpportunityCandidates(
    [
      ...repeatCandidates,
      ...gapCandidates,
      ...(contrarianCandidate ? [contrarianCandidate] : []),
    ].sort((left, right) => right.score - left.score)
  ).slice(0, 5);

  const response: ChannelOpportunitiesResponse = {
    channel: slug,
    items: candidates.map((candidate) => ({
      id: candidate.id,
      channelSlug: slug,
      opportunityType: candidate.opportunityType,
      title: candidate.title,
      topic: candidate.topic,
      angle: candidate.angle,
      rationale: candidate.rationale,
      whyNow: candidate.whyNow,
      recommendedHook: candidate.recommendedHook,
      recommendedFormat: candidate.recommendedFormat,
      recommendedDuration: candidate.recommendedDuration,
      thumbnailDirection: candidate.thumbnailDirection,
      score: candidate.score,
      scoreLabel: getOpportunityScoreLabel(candidate.score),
      channelEvidence: candidate.channelEvidence,
      competitorEvidence: candidate.competitorEvidence,
      packageSeed: candidate.packageSeed,
    })),
    count: candidates.length,
    generatedAt: new Date().toISOString(),
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

async function handleScriptLabRoute(
  parts: string[],
  request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  if (parts[2] !== "projects") {
    return jsonResponse({ error: "Not found" }, 404);
  }

  if (!parts[3]) {
    if (request.method === "GET") return listScriptProjects(context, env);
    if (request.method === "POST") return createScriptProject(request, context, env);
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const projectId = decodeURIComponent(parts[3]);

  if (parts.length === 4) {
    if (request.method === "GET") return getScriptProject(projectId, context, env);
    if (request.method === "PATCH") return updateScriptProject(projectId, request, context, env);
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (parts[4] === "research") return buildScriptResearch(projectId, request, context, env);
  if (parts[4] === "generate") return generateScriptProjectOutput(projectId, request, context, env);

  return jsonResponse({ error: "Not found" }, 404);
}

async function handlePersonaModelsRoute(
  parts: string[],
  request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  if (!parts[2]) {
    if (request.method === "GET") return listPersonaModels(context, env);
    if (request.method === "POST") return createPersonaModel(request, context, env);
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const modelId = decodeURIComponent(parts[2]);

  if (parts.length === 3) {
    if (request.method === "GET") return getPersonaModel(modelId, context, env);
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (parts[3] === "train" && request.method === "POST") {
    return trainPersonaModel(modelId, request, context, env);
  }

  return jsonResponse({ error: "Not found" }, 404);
}

function parseJsonObject(rawValue: string | null | undefined): JsonObject {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}

function parseJsonStringList(rawValue: string | null | undefined): string[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed)
      ? parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function parseBoolean(rawValue: unknown, fallback = false): boolean {
  if (typeof rawValue === "boolean") return rawValue;
  if (typeof rawValue === "string") {
    if (rawValue === "true") return true;
    if (rawValue === "false") return false;
  }
  return fallback;
}

function toThumbnailAnalysisSummary(
  row: ThumbnailAnalysisRow | Record<string, unknown>
): ThumbnailAnalysisSummary | null {
  const modelKey = row.thumbnail_model_key ? String(row.thumbnail_model_key) : null;
  if (!modelKey) return null;

  return {
    provider: String(row.thumbnail_provider ?? "gemini"),
    modelKey,
    textOverlay: row.thumbnail_text_overlay ? String(row.thumbnail_text_overlay) : null,
    textOverlayPresent: Boolean(Number(row.thumbnail_text_overlay_present ?? 0)),
    textPosition: String(row.thumbnail_text_position ?? "none"),
    textSize: String(row.thumbnail_text_size ?? "none"),
    hasFace: Boolean(Number(row.thumbnail_has_face ?? 0)),
    faceCount: Number(row.thumbnail_face_count ?? 0),
    expression: row.thumbnail_expression ? String(row.thumbnail_expression) : null,
    dominantColors: parseJsonStringList(
      row.thumbnail_dominant_colors ? String(row.thumbnail_dominant_colors) : null
    ),
    compositionStyle: String(row.thumbnail_composition_style ?? "other"),
    primarySubject: row.thumbnail_primary_subject ? String(row.thumbnail_primary_subject) : null,
    objects: parseJsonStringList(row.thumbnail_objects_json ? String(row.thumbnail_objects_json) : null),
    visualHook: row.thumbnail_visual_hook ? String(row.thumbnail_visual_hook) : null,
    whyItWorks: row.thumbnail_why_it_works ? String(row.thumbnail_why_it_works) : null,
    clarityScore:
      row.thumbnail_clarity_score === null || row.thumbnail_clarity_score === undefined
        ? null
        : Number(row.thumbnail_clarity_score),
  };
}

function isScriptLabStep(rawValue: string): rawValue is ScriptLabStep {
  return (
    rawValue === "hooks" ||
    rawValue === "outline" ||
    rawValue === "script" ||
    rawValue === "director_notes" ||
    rawValue === "thumbnail_brief" ||
    rawValue === "previs"
  );
}

function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function normalizeOpportunityToken(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized || normalized.length < 3) return null;
  if (OPPORTUNITY_STOP_WORDS.has(normalized)) return null;
  return normalized;
}

function tokenizeOpportunityText(value: string): string[] {
  const tokens = value
    .split(/[^a-zA-Z0-9]+/)
    .map(normalizeOpportunityToken)
    .filter((token): token is string => Boolean(token));
  return [...new Set(tokens)];
}

function buildOpportunityResearchQuery(
  projectTopic: string,
  opportunity: ChannelOpportunity | null
): string {
  if (!opportunity) return projectTopic;
  return [opportunity.topic, opportunity.angle, opportunity.whyNow].filter(Boolean).join(". ");
}

function buildOpportunityResearchTokens(
  projectTopic: string,
  opportunity: ChannelOpportunity | null
): string[] {
  return tokenizeOpportunityText(
    [
      projectTopic,
      opportunity?.title ?? "",
      opportunity?.topic ?? "",
      opportunity?.angle ?? "",
      opportunity?.recommendedHook ?? "",
      opportunity?.rationale ?? "",
      opportunity?.whyNow ?? "",
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function scoreOpportunityTextOverlap(value: string, tokens: string[]): number {
  if (!value || tokens.length === 0) return 0;
  const haystackTokens = new Set(tokenizeOpportunityText(value));
  let matches = 0;

  for (const token of tokens) {
    if (haystackTokens.has(token)) matches += 1;
  }

  return matches;
}

function selectOpportunityQuoteItems(
  semanticMatches: SearchResultItem[] | null,
  textMatches: SearchResultItem[],
  tokens: string[],
  limit: number
): SearchResultItem[] {
  const merged = new Map<
    string,
    {
      overlapScore: number;
      semanticScore: number;
      viewCount: number;
      item: SearchResultItem;
    }
  >();

  for (const item of [...(semanticMatches ?? []), ...textMatches]) {
    const key = item.vectorId || `${item.youtubeId}:${item.startTime}:${item.channelSlug}`;
    const overlapScore = scoreOpportunityTextOverlap(`${item.title} ${item.snippet}`, tokens);
    const semanticScore = item.score ?? 0;
    const existing = merged.get(key);

    if (
      !existing ||
      overlapScore > existing.overlapScore ||
      (overlapScore === existing.overlapScore && semanticScore > existing.semanticScore)
    ) {
      merged.set(key, {
        overlapScore,
        semanticScore,
        viewCount: item.viewCount,
        item,
      });
    }
  }

  const ranked = [...merged.values()]
    .sort((left, right) => {
      if (right.overlapScore !== left.overlapScore) return right.overlapScore - left.overlapScore;
      if (right.semanticScore !== left.semanticScore) return right.semanticScore - left.semanticScore;
      return right.viewCount - left.viewCount;
    })
    .map((entry) => entry.item);

  const relevant = ranked.filter((item) =>
    scoreOpportunityTextOverlap(`${item.title} ${item.snippet}`, tokens) > 0
  );

  return (relevant.length > 0 ? relevant : ranked).slice(0, limit);
}

function selectRelevantHooksForOpportunity(
  hooks: HookSummary[],
  tokens: string[],
  limit: number
): HookSummary[] {
  const ranked = [...hooks].sort((left, right) => {
    const leftOverlap = scoreOpportunityTextOverlap(`${left.videoTitle} ${left.text}`, tokens);
    const rightOverlap = scoreOpportunityTextOverlap(`${right.videoTitle} ${right.text}`, tokens);
    if (rightOverlap !== leftOverlap) return rightOverlap - leftOverlap;
    return right.viewCount - left.viewCount;
  });

  const relevant = ranked.filter(
    (hook) => scoreOpportunityTextOverlap(`${hook.videoTitle} ${hook.text}`, tokens) > 0
  );

  return (relevant.length > 0 ? relevant : ranked).slice(0, limit);
}

function selectRelevantTopicClustersForOpportunity(
  topicClusters: ChannelAnalytics["topicClusters"],
  tokens: string[],
  limit: number
) {
  const ranked = [...topicClusters].sort((left, right) => {
    const leftOverlap = scoreOpportunityTextOverlap(
      `${left.topic} ${left.topVideoTitle}`,
      tokens
    );
    const rightOverlap = scoreOpportunityTextOverlap(
      `${right.topic} ${right.topVideoTitle}`,
      tokens
    );
    if (rightOverlap !== leftOverlap) return rightOverlap - leftOverlap;
    return right.averageViews - left.averageViews;
  });

  const relevant = ranked.filter(
    (topic) => scoreOpportunityTextOverlap(`${topic.topic} ${topic.topVideoTitle}`, tokens) > 0
  );

  return (relevant.length > 0 ? relevant : ranked).slice(0, limit);
}

function clampOpportunityScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getOpportunityScoreLabel(score: number): string {
  if (score >= 88) return "Best next bet";
  if (score >= 78) return "High-confidence angle";
  if (score >= 68) return "Worth testing";
  return "Exploratory";
}

function normalizeOpportunityEvidence(
  rawValue: unknown
): ChannelOpportunityEvidence | null {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const value = rawValue as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const detail = typeof value.detail === "string" ? value.detail.trim() : "";
  if (!title || !detail) return null;

  return {
    title,
    detail,
    supportingMetric:
      typeof value.supportingMetric === "string" && value.supportingMetric.trim()
        ? value.supportingMetric.trim()
        : null,
    href: typeof value.href === "string" && value.href.trim() ? value.href.trim() : null,
  };
}

function normalizeOpportunityPayload(
  rawValue: unknown,
  fallbackChannelSlug: string | null
): ChannelOpportunity | null {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const value = rawValue as Record<string, unknown>;
  const topic = typeof value.topic === "string" ? value.topic.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const angle = typeof value.angle === "string" ? value.angle.trim() : "";
  const rationale = typeof value.rationale === "string" ? value.rationale.trim() : "";
  const whyNow = typeof value.whyNow === "string" ? value.whyNow.trim() : "";
  const recommendedHook =
    typeof value.recommendedHook === "string" ? value.recommendedHook.trim() : "";
  const recommendedFormat =
    typeof value.recommendedFormat === "string" ? value.recommendedFormat.trim() : "";
  const recommendedDuration =
    typeof value.recommendedDuration === "string" ? value.recommendedDuration.trim() : "";
  const thumbnailDirection =
    typeof value.thumbnailDirection === "string" ? value.thumbnailDirection.trim() : "";
  const rawType =
    value.opportunityType === "adjacent_whitespace" ||
    value.opportunityType === "contrarian_take" ||
    value.opportunityType === "repeat_winner"
      ? value.opportunityType
      : "repeat_winner";
  const channelSlug =
    typeof value.channelSlug === "string" && value.channelSlug.trim()
      ? value.channelSlug.trim()
      : fallbackChannelSlug;

  if (
    !channelSlug ||
    !topic ||
    !title ||
    !angle ||
    !rationale ||
    !whyNow ||
    !recommendedHook ||
    !recommendedFormat ||
    !recommendedDuration ||
    !thumbnailDirection
  ) {
    return null;
  }

  const score =
    typeof value.score === "number" && Number.isFinite(value.score)
      ? clampOpportunityScore(value.score)
      : 72;

  const rawPackageSeed =
    value.packageSeed && typeof value.packageSeed === "object" && !Array.isArray(value.packageSeed)
      ? (value.packageSeed as Record<string, unknown>)
      : {};

  const packageTitle =
    typeof rawPackageSeed.title === "string" && rawPackageSeed.title.trim()
      ? rawPackageSeed.title.trim()
      : title;
  const packageTopic =
    typeof rawPackageSeed.topic === "string" && rawPackageSeed.topic.trim()
      ? rawPackageSeed.topic.trim()
      : topic;

  const channelEvidence = Array.isArray(value.channelEvidence)
    ? value.channelEvidence
        .map(normalizeOpportunityEvidence)
        .filter((item): item is ChannelOpportunityEvidence => Boolean(item))
    : [];
  const competitorEvidence = Array.isArray(value.competitorEvidence)
    ? value.competitorEvidence
        .map(normalizeOpportunityEvidence)
        .filter((item): item is ChannelOpportunityEvidence => Boolean(item))
    : [];

  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id.trim()
        : `${channelSlug}-${rawType}-${slugifyValue(topic)}`,
    channelSlug,
    opportunityType: rawType,
    title,
    topic,
    angle,
    rationale,
    whyNow,
    recommendedHook,
    recommendedFormat,
    recommendedDuration,
    thumbnailDirection,
    score,
    scoreLabel:
      typeof value.scoreLabel === "string" && value.scoreLabel.trim()
        ? value.scoreLabel.trim()
        : getOpportunityScoreLabel(score),
    channelEvidence,
    competitorEvidence,
    packageSeed: {
      title: packageTitle,
      topic: packageTopic,
    },
  };
}

function parseChannelOpportunity(rawValue: string | null | undefined): ChannelOpportunity | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return normalizeOpportunityPayload(parsed, null);
  } catch {
    return null;
  }
}

function toScriptProjectSummary(row: ScriptProjectRow): ScriptProjectSummary {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    status: row.status,
    channelSlug: row.channel_slug,
    channelName: row.channel_name,
    personaModelId: row.persona_model_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    researchItemCount: Number(row.research_item_count ?? 0),
    latestOutputStep: row.latest_output_step,
    latestOutputVersion:
      row.latest_output_version === null || row.latest_output_version === undefined
        ? null
        : Number(row.latest_output_version),
    opportunity: parseChannelOpportunity(row.opportunity_json),
  };
}

function toScriptResearchItem(row: ScriptResearchItemRow): ScriptResearchItem {
  return {
    id: row.id,
    itemType: row.item_type,
    sourceChannelSlug: row.source_channel_slug,
    sourceYoutubeId: row.source_youtube_id,
    sourceVectorId: row.source_vector_id,
    title: row.title,
    excerpt: row.excerpt,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    metadata: parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
  };
}

function toScriptOutputVersion(row: ScriptOutputRow): ScriptOutputVersion {
  return {
    id: row.id,
    step: row.step,
    version: Number(row.version ?? 1),
    modelKey: row.model_key,
    content: row.content,
    metadata: parseJsonObject(row.metadata_json),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function toThumbnailBriefVersion(row: ThumbnailBriefRow): ThumbnailBriefVersion {
  return {
    id: row.id,
    version: Number(row.version ?? 1),
    content: row.content,
    metadata: parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
  };
}

function toGenerationJobSummary(row: GenerationJobRow): GenerationJobSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    personaModelId: row.persona_model_id,
    jobType: row.job_type,
    provider: row.provider,
    providerJobId: row.provider_job_id,
    status: row.status,
    stage: row.stage,
    progress: Number(row.progress ?? 0),
    input: parseJsonObject(row.input_json),
    output: parseJsonObject(row.output_json),
    message: row.message,
    errorMessage: row.error_message,
    createdByUserId: row.created_by_user_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toGenerationAssetSummary(row: GenerationAssetRow): GenerationAssetSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    generationJobId: row.generation_job_id,
    assetKind: row.asset_kind,
    variant: row.variant,
    mimeType: row.mime_type,
    fileName: row.file_name,
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    metadata: parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
    downloadPath: `/api/assets/${encodeURIComponent(row.id)}`,
  };
}

function normalizePersonaStatus(row: PersonaModelRow): string {
  if (row.status === "ready" && !row.adapter_path) {
    return "draft";
  }

  return row.status;
}

function toPersonaModelSummary(row: PersonaModelRow): PersonaModelSummary {
  return {
    id: row.id,
    channelSlug: row.channel_slug,
    channelName: row.channel_name,
    status: normalizePersonaStatus(row),
    provider: row.provider,
    providerJobId: row.provider_job_id,
    baseModel: row.base_model,
    adapterPath: row.adapter_path,
    datasetPath: row.dataset_path,
    datasetExamples: Number(row.dataset_examples ?? 0),
    metadata: parseJsonObject(row.metadata_json),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type PersonaStyleSample = {
  prompt: string;
  title: string;
  content: string;
  source: string;
};

function coerceString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readPersonaStyleSamples(row: PersonaModelRow | null): PersonaStyleSample[] {
  if (!row) return [];

  const metadata = parseJsonObject(row.metadata_json);
  const directSamples = Array.isArray(metadata.styleSamples)
    ? metadata.styleSamples
    : [];
  const nestedOutput =
    metadata.lastTrainingOutput &&
    typeof metadata.lastTrainingOutput === "object" &&
    !Array.isArray(metadata.lastTrainingOutput)
      ? (metadata.lastTrainingOutput as JsonObject)
      : {};
  const nestedSamples = Array.isArray(nestedOutput.styleSamples)
    ? nestedOutput.styleSamples
    : [];

  const rawSamples = [...directSamples, ...nestedSamples];
  const samples: PersonaStyleSample[] = [];

  for (const rawSample of rawSamples) {
    if (!rawSample || typeof rawSample !== "object" || Array.isArray(rawSample)) {
      continue;
    }
    const sample = rawSample as Record<string, unknown>;
    const content = coerceString(sample.content);
    if (!content) continue;
    samples.push({
      prompt: coerceString(sample.prompt) ?? "Persona sample",
      title: coerceString(sample.title) ?? "Style sample",
      content,
      source: coerceString(sample.source) ?? "trained-persona",
    });
  }

  return samples.slice(0, 4);
}

function buildFallbackPersonaSamples(topHooks: HookSummary[]): PersonaStyleSample[] {
  return topHooks.slice(0, 3).map((hook, index) => ({
    prompt: `Reference hook ${index + 1}`,
    title: hook.videoTitle,
    content: buildSnippet(hook.text, 180),
    source: "channel-corpus",
  }));
}

type ScriptLabAiGenerationResult = {
  content: string;
  metadata: JsonObject;
  modelKey: string;
};

function buildScriptLabResearchDigest(researchItems: ScriptResearchItem[]): string {
  return researchItems
    .slice(0, 8)
    .map((item, index) => {
      const title = item.title ? `${item.title}: ` : "";
      const excerpt = item.excerpt ? buildSnippet(item.excerpt, 220) : "";
      const score = typeof item.score === "number" ? ` [score ${Math.round(item.score)}]` : "";
      return `${index + 1}. [${item.itemType}] ${title}${excerpt}${score}`.trim();
    })
    .filter(Boolean)
    .join("\n");
}

function buildScriptLabPreviousOutputDigest(
  existingOutputs: Array<{ content: string; step: string; version: number }>,
  activeStep: ScriptLabStep
): string {
  const relevantSteps = new Set<ScriptLabStep | string>();

  if (activeStep === "outline") {
    relevantSteps.add("hooks");
  } else if (activeStep === "script") {
    relevantSteps.add("hooks");
    relevantSteps.add("outline");
  } else if (activeStep === "director_notes") {
    relevantSteps.add("hooks");
    relevantSteps.add("outline");
    relevantSteps.add("script");
  } else if (activeStep === "thumbnail_brief") {
    relevantSteps.add("hooks");
    relevantSteps.add("script");
  }

  return existingOutputs
    .filter((output) => relevantSteps.has(output.step))
    .sort((left, right) => left.step.localeCompare(right.step) || right.version - left.version)
    .slice(0, 3)
    .map((output) => `## ${output.step}\n${buildSnippet(output.content, 700)}`)
    .join("\n\n");
}

function getScriptLabAiRequirements(step: ScriptLabStep, channelName: string): string {
  switch (step) {
    case "hooks":
      return [
        "- Produce exactly 3 hook options.",
        "- Each hook should feel like a real YouTube opener for a contrarian business/wealth channel.",
        "- After the hooks, include a short section explaining why the winner should work and which proof point lands first.",
        `- Keep the voice direct, operator-first, and sharp for ${channelName}.`,
      ].join("\n");
    case "outline":
      return [
        "- Build a concise 6-part outline.",
        "- Make the proof stack specific; avoid generic filler sections.",
        "- The outline should create momentum toward a clear business lesson.",
      ].join("\n");
    case "script":
      return [
        "- Write only the first 60-90 seconds.",
        "- Make it sound like a strong YouTube cold open, not an essay.",
        "- Use specific proof from the evidence set early.",
        "- Avoid generic motivational phrasing, broad platitudes, or template filler.",
      ].join("\n");
    case "director_notes":
      return [
        "- Write shot-by-shot notes for the opening minute.",
        "- Include pacing, cut style, text overlays, and what visual proof appears when.",
        "- Keep it practical enough that an editor or producer could use it immediately.",
      ].join("\n");
    case "thumbnail_brief":
      return [
        "- Produce exactly 2 thumbnail concepts.",
        "- Each concept must include headline text (max 4 words), subject/framing, and why it should win.",
        "- Use previous channel winners as style references, not as copies.",
      ].join("\n");
    default:
      return "- Return a production-ready markdown deliverable.";
  }
}

function stripMarkdownCodeFences(value: string): string {
  return value
    .replace(/^```[a-zA-Z0-9_-]*\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

async function maybeGenerateScriptLabStepWithAi(
  step: ScriptLabStep,
  context: ScriptLabGenerationContext,
  researchItems: ScriptResearchItem[],
  selectedPersonaModel: PersonaModelRow | null,
  topHooks: HookSummary[],
  env: Env
): Promise<ScriptLabAiGenerationResult | null> {
  if (!env.AI || !AI_SCRIPT_LAB_STEPS.has(step)) return null;

  const model = env.SCRIPT_LAB_TEXT_MODEL?.trim() || DEFAULT_SCRIPT_LAB_TEXT_MODEL;
  const fallback = generateScriptLabStep(step, context);
  const extractedPersonaSamples = readPersonaStyleSamples(selectedPersonaModel);
  const personaSamples =
    extractedPersonaSamples.length > 0
      ? extractedPersonaSamples
      : selectedPersonaModel
        ? buildFallbackPersonaSamples(topHooks)
        : [];

  const personaDigest = personaSamples
    .slice(0, 3)
    .map(
      (sample, index) =>
        `${index + 1}. ${sample.prompt} — ${buildSnippet(sample.content, 180)}`
    )
    .join("\n");
  const opportunityDigest = context.opportunity
    ? [
        `Selected opportunity: ${context.opportunity.title}`,
        `Topic: ${context.opportunity.topic}`,
        `Angle: ${context.opportunity.angle}`,
        `Why now: ${context.opportunity.whyNow}`,
        `Recommended hook: ${context.opportunity.recommendedHook}`,
      ].join("\n")
    : `Topic: ${context.topic}`;
  const researchDigest = buildScriptLabResearchDigest(researchItems);
  const previousOutputDigest = buildScriptLabPreviousOutputDigest(context.existingOutputs, step);

  const systemPrompt = [
    "You are a senior YouTube strategist and scriptwriter for business, wealth, and business-buying content.",
    "Your job is to turn channel evidence into a specific, publishable deliverable.",
    "Be concrete, opinionated, and useful.",
    "Avoid generic filler, vague hype, or obvious AI phrasing.",
    "Return markdown only with no code fences and no preamble.",
  ].join(" ");

  const userPrompt = [
    `Create the ${step} deliverable for "${context.projectTitle}".`,
    opportunityDigest,
    researchDigest ? `Evidence set:\n${researchDigest}` : "",
    personaDigest
      ? `Voice references from the trained persona or channel corpus:\n${personaDigest}`
      : "",
    previousOutputDigest ? `Existing approved context:\n${previousOutputDigest}` : "",
    `Requirements:\n${getScriptLabAiRequirements(step, context.channelName)}`,
    "Use the scaffold below only as a baseline to improve substantially. Keep the same general structure if it helps, but make the output sharper and more specific.",
    fallback.content.slice(0, 3200),
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const runScriptLabModel = env.AI.run as (
      modelName: string,
      inputs: Record<string, unknown>,
    ) => Promise<unknown>;

    const response = await runScriptLabModel(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: step === "script" ? 1400 : 900,
      temperature: step === "hooks" ? 0.85 : 0.45,
    });
    const content = extractAiTextResponse(response);
    if (!content) return null;

    return {
      content: stripMarkdownCodeFences(content),
      metadata: {
        source: "workers-ai",
        fallbackSource: fallback.metadata.source ?? "template",
        model,
        personaModelId: selectedPersonaModel?.id ?? null,
        personaSampleCount: personaSamples.length,
        opportunityId: context.opportunity?.id ?? null,
      },
      modelKey: `workers-ai:${model}`,
    };
  } catch (error) {
    console.error("workers-ai-script-lab-fallback", {
      error: error instanceof Error ? error.message : String(error),
      model,
      step,
    });
    return null;
  }
}

async function validatePersonaModelSelection(
  personaModelId: string | null,
  channelSlug: string | null,
  context: RequestContext,
  env: Env
): Promise<PersonaModelRow | null> {
  if (!personaModelId) return null;

  const personaModel = await findPersonaModelRow(personaModelId, context, env);
  if (!personaModel) {
    throw new Error("Persona model not found");
  }
  if (normalizePersonaStatus(personaModel) !== "ready") {
    throw new Error("Persona model is not ready yet");
  }
  if (channelSlug && personaModel.channel_slug && personaModel.channel_slug !== channelSlug) {
    throw new Error("Persona model must belong to the selected channel");
  }

  return personaModel;
}

async function findScriptProjectRow(
  projectId: string,
  context: RequestContext,
  env: Env
): Promise<ScriptProjectRow | null> {
  const row = await env.DB.prepare(
    `
      SELECT ${SCRIPT_PROJECT_SELECT}
      FROM script_projects sp
      LEFT JOIN channels c ON c.id = sp.channel_id
      WHERE sp.id = ? AND sp.workspace_id = ?
      LIMIT 1
    `
  )
    .bind(projectId, context.workspace.id)
    .first<ScriptProjectRow>();

  return row ?? null;
}

async function findPersonaModelRow(
  modelId: string,
  context: RequestContext,
  env: Env
): Promise<PersonaModelRow | null> {
  const row = await env.DB.prepare(
    `
      SELECT ${PERSONA_MODEL_SELECT}
      FROM persona_models pm
      LEFT JOIN channels c ON c.id = pm.channel_id
      WHERE pm.id = ? AND pm.workspace_id = ?
      LIMIT 1
    `
  )
    .bind(modelId, context.workspace.id)
    .first<PersonaModelRow>();

  return row ?? null;
}

async function listScriptResearchItems(projectId: string, env: Env): Promise<ScriptResearchItem[]> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT ${SCRIPT_RESEARCH_SELECT}
      FROM script_research_items
      WHERE project_id = ?
      ORDER BY score DESC, created_at ASC
    `
  )
    .bind(projectId)
    .all<ScriptResearchItemRow>();

  return results.map(toScriptResearchItem);
}

async function listScriptOutputs(projectId: string, env: Env): Promise<ScriptOutputVersion[]> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT ${SCRIPT_OUTPUT_SELECT}
      FROM script_outputs
      WHERE project_id = ?
      ORDER BY step ASC, version DESC, created_at DESC
    `
  )
    .bind(projectId)
    .all<ScriptOutputRow>();

  return results.map(toScriptOutputVersion);
}

async function listThumbnailBriefs(projectId: string, env: Env): Promise<ThumbnailBriefVersion[]> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT ${THUMBNAIL_BRIEF_SELECT}
      FROM thumbnail_briefs
      WHERE project_id = ?
      ORDER BY version DESC, created_at DESC
    `
  )
    .bind(projectId)
    .all<ThumbnailBriefRow>();

  return results.map(toThumbnailBriefVersion);
}

async function listGenerationJobsForProject(
  projectId: string,
  workspaceId: string,
  env: Env
): Promise<GenerationJobSummary[]> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT ${GENERATION_JOB_SELECT}
      FROM generation_jobs
      WHERE workspace_id = ? AND project_id = ?
      ORDER BY created_at DESC
    `
  )
    .bind(workspaceId, projectId)
    .all<GenerationJobRow>();

  return results.map(toGenerationJobSummary);
}

async function listGenerationAssetsForProject(
  projectId: string,
  workspaceId: string,
  env: Env
): Promise<GenerationAssetSummary[]> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT ${GENERATION_ASSET_SELECT}
      FROM generation_assets
      WHERE workspace_id = ? AND project_id = ?
      ORDER BY created_at DESC
    `
  )
    .bind(workspaceId, projectId)
    .all<GenerationAssetRow>();

  return results.map(toGenerationAssetSummary);
}

async function listGenerationJobsForPersonaModel(
  modelId: string,
  workspaceId: string,
  env: Env
): Promise<GenerationJobSummary[]> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT ${GENERATION_JOB_SELECT}
      FROM generation_jobs
      WHERE workspace_id = ? AND persona_model_id = ?
      ORDER BY created_at DESC
    `
  )
    .bind(workspaceId, modelId)
    .all<GenerationJobRow>();

  return results.map(toGenerationJobSummary);
}

async function loadScriptProjectDetail(
  projectId: string,
  context: RequestContext,
  env: Env
): Promise<ScriptProjectDetail | null> {
  const row = await findScriptProjectRow(projectId, context, env);
  if (!row) return null;

  const [researchItems, outputs, thumbnailBriefs, generationJobs, generatedAssets] = await Promise.all([
    listScriptResearchItems(projectId, env),
    listScriptOutputs(projectId, env),
    listThumbnailBriefs(projectId, env),
    listGenerationJobsForProject(projectId, context.workspace.id, env),
    listGenerationAssetsForProject(projectId, context.workspace.id, env),
  ]);

  return {
    ...toScriptProjectSummary(row),
    researchItems,
    outputs,
    thumbnailBriefs,
    generationJobs,
    generatedAssets,
  };
}

async function listScriptProjects(context: RequestContext, env: Env): Promise<Response> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT ${SCRIPT_PROJECT_SELECT}
      FROM script_projects sp
      LEFT JOIN channels c ON c.id = sp.channel_id
      WHERE sp.workspace_id = ?
      ORDER BY sp.updated_at DESC, sp.created_at DESC
    `
  )
    .bind(context.workspace.id)
    .all<ScriptProjectRow>();

  const response: ScriptProjectListResponse = {
    items: results.map(toScriptProjectSummary),
    count: results.length,
  };

  return jsonResponse(response);
}

async function createScriptProject(
  request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const topic = String(payload?.topic ?? "").trim();
  const title = String(payload?.title ?? "").trim() || `${topic || "Untitled"} Script`;
  const requestedStatus = String(payload?.status ?? "draft").trim() || "draft";
  const channelSlug =
    String(payload?.channelSlug ?? payload?.channel ?? env.DEFAULT_CHANNEL_SLUG ?? "").trim() || null;
  const requestedPersonaModelId =
    String(payload?.personaModelId ?? "").trim() || null;
  const opportunity = normalizeOpportunityPayload(payload?.opportunity, channelSlug);

  if (!topic) {
    return jsonResponse({ error: "topic is required" }, 400);
  }

  const channel = channelSlug ? await findChannel(channelSlug, context, env) : null;
  if (channelSlug && !channel) {
    return jsonResponse({ error: "Channel not found" }, 404);
  }

  let personaModel: PersonaModelRow | null = null;
  try {
    personaModel = await validatePersonaModelSelection(
      requestedPersonaModelId,
      channelSlug,
      context,
      env
    );
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid persona model" },
      400
    );
  }

  const projectId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `
      INSERT INTO script_projects (
        id,
        workspace_id,
        channel_id,
        persona_model_id,
        opportunity_json,
        title,
        topic,
        status,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      projectId,
      context.workspace.id,
      channel?.id ?? null,
      personaModel?.id ?? null,
      opportunity ? JSON.stringify(opportunity) : null,
      title,
      topic,
      requestedStatus,
      context.session.user.id,
      now,
      now
    )
    .run();

  const detail = await loadScriptProjectDetail(projectId, context, env);
  const response: ScriptProjectResponse = {
    project: detail as ScriptProjectDetail,
  };
  return jsonResponse(response, 201);
}

async function getScriptProject(
  projectId: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const detail = await loadScriptProjectDetail(projectId, context, env);
  if (!detail) return jsonResponse({ error: "Script project not found" }, 404);

  const response: ScriptProjectResponse = { project: detail };
  return jsonResponse(response);
}

async function updateScriptProject(
  projectId: string,
  request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const existing = await findScriptProjectRow(projectId, context, env);
  if (!existing) return jsonResponse({ error: "Script project not found" }, 404);

  const payload = await readJsonBody<Record<string, unknown>>(request);
  const assignments = ["updated_at = ?"];
  const binds: unknown[] = [new Date().toISOString()];

  if (payload.title !== undefined) {
    assignments.push("title = ?");
    binds.push(String(payload.title ?? "").trim() || existing.title);
  }

  if (payload.topic !== undefined) {
    const topic = String(payload.topic ?? "").trim();
    if (!topic) return jsonResponse({ error: "topic cannot be empty" }, 400);
    assignments.push("topic = ?");
    binds.push(topic);
  }

  if (payload.status !== undefined) {
    assignments.push("status = ?");
    binds.push(String(payload.status ?? "").trim() || existing.status);
  }

  if (payload.channelSlug !== undefined || payload.channel !== undefined) {
    const channelSlug = String(payload.channelSlug ?? payload.channel ?? "").trim();
    if (!channelSlug) {
      assignments.push("channel_id = NULL");
    } else {
      const channel = await findChannel(channelSlug, context, env);
      if (!channel) return jsonResponse({ error: "Channel not found" }, 404);
      assignments.push("channel_id = ?");
      binds.push(channel.id);
    }
  }

  if (payload.personaModelId !== undefined) {
    const personaModelId = String(payload.personaModelId ?? "").trim() || null;
    const selectedChannelSlug =
      payload.channelSlug !== undefined || payload.channel !== undefined
        ? String(payload.channelSlug ?? payload.channel ?? "").trim() || null
        : existing.channel_slug;
    if (!personaModelId) {
      assignments.push("persona_model_id = NULL");
    } else {
      try {
        const personaModel = await validatePersonaModelSelection(
          personaModelId,
          selectedChannelSlug,
          context,
          env
        );
        assignments.push("persona_model_id = ?");
        binds.push(personaModel?.id ?? null);
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Invalid persona model" },
          400
        );
      }
    }
  }

  if (payload.opportunity !== undefined) {
    const selectedChannelSlug =
      payload.channelSlug !== undefined || payload.channel !== undefined
        ? String(payload.channelSlug ?? payload.channel ?? "").trim() || null
        : existing.channel_slug;
    const opportunity = normalizeOpportunityPayload(payload.opportunity, selectedChannelSlug);
    assignments.push("opportunity_json = ?");
    binds.push(opportunity ? JSON.stringify(opportunity) : null);
  }

  binds.push(projectId, context.workspace.id);

  await env.DB.prepare(
    `UPDATE script_projects SET ${assignments.join(", ")} WHERE id = ? AND workspace_id = ?`
  )
    .bind(...binds)
    .run();

  const detail = await loadScriptProjectDetail(projectId, context, env);
  return jsonResponse({ project: detail });
}

async function rebuildScriptResearch(
  project: ScriptProjectRow,
  context: RequestContext,
  env: Env
): Promise<ScriptResearchItem[]> {
  if (!project.channel_slug) {
    return [];
  }

  const analytics = await getChannelAnalytics(project.channel_slug, context, env);
  if (!analytics) return [];
  const selectedOpportunity = parseChannelOpportunity(project.opportunity_json);
  const researchQuery = buildOpportunityResearchQuery(project.topic, selectedOpportunity);
  const researchTokens = buildOpportunityResearchTokens(project.topic, selectedOpportunity);

  const searchFilters: SearchFilters = {
    channelSlug: project.channel_slug,
    minViews: null,
    performanceTier: null,
    dateFrom: null,
    dateTo: null,
  };

  const [semanticMatches, textMatches, topHooks, workspaceChannels] = await Promise.all([
    runSemanticSearch(researchQuery, searchFilters, selectedOpportunity ? 8 : 6, context, env),
    runTextSearch(researchQuery, searchFilters, selectedOpportunity ? 8 : 6, context, env),
    fetchHooks(analytics.channel.id, env, { limit: 5, sort: "views" }),
    listWorkspaceChannelRows(context, env),
  ]);
  const personaModel = project.persona_model_id
    ? await findPersonaModelRow(project.persona_model_id, context, env)
    : null;
  const extractedPersonaSamples = readPersonaStyleSamples(personaModel);
  const personaSamples =
    extractedPersonaSamples.length > 0
      ? extractedPersonaSamples
      : personaModel
        ? buildFallbackPersonaSamples(topHooks)
        : [];

  const quoteItems = selectedOpportunity
    ? selectOpportunityQuoteItems(semanticMatches, textMatches, researchTokens, 4)
    : (semanticMatches && semanticMatches.length > 0 ? semanticMatches : textMatches).slice(0, 6);
  const prioritizedHooks = selectedOpportunity
    ? selectRelevantHooksForOpportunity(topHooks, researchTokens, 3)
    : topHooks.slice(0, 5);
  const prioritizedTopicClusters = selectedOpportunity
    ? selectRelevantTopicClustersForOpportunity(analytics.topicClusters, researchTokens, 2)
    : analytics.topicClusters.slice(0, 4);
  const gapItems: Array<{
    averageViews: number;
    exemplarTitle: string;
    exemplarVideoUrl: string;
    exemplarYoutubeId: string;
    opportunityScore: number;
    sourceChannel: string;
    topic: string;
  }> = [];

  if (!selectedOpportunity) {
    const competitorChannels = workspaceChannels.filter((channel) => channel.slug !== project.channel_slug);
    for (const competitor of competitorChannels) {
      const competitorAnalytics = await getChannelAnalytics(competitor.slug, context, env);
      if (!competitorAnalytics) continue;

      const comparison = buildComparison(
        {
          slug: analytics.channel.slug,
          channelName: analytics.channel.channel_name,
          totalVideos: analytics.videos.length,
          averageViews: analytics.averageViews,
          medianViews: analytics.medianViews,
          averageEngagementRate: analytics.averageEngagementRate,
          uploadCadencePerWeek: analytics.stats.uploadCadencePerWeek.current,
          bestDuration: analytics.stats.bestDuration,
          topicClusters: analytics.topicClusters,
        },
        {
          slug: competitorAnalytics.channel.slug,
          channelName: competitorAnalytics.channel.channel_name,
          totalVideos: competitorAnalytics.videos.length,
          averageViews: competitorAnalytics.averageViews,
          medianViews: competitorAnalytics.medianViews,
          averageEngagementRate: competitorAnalytics.averageEngagementRate,
          uploadCadencePerWeek: competitorAnalytics.stats.uploadCadencePerWeek.current,
          bestDuration: competitorAnalytics.stats.bestDuration,
          topicClusters: competitorAnalytics.topicClusters,
        }
      );

      gapItems.push(
        ...comparison.topicGaps
          .filter((item) => item.missingOn === analytics.channel.slug)
          .map((item) => ({
            averageViews: item.averageViews,
            exemplarTitle: item.exemplarTitle,
            exemplarVideoUrl: item.exemplarVideoUrl,
            exemplarYoutubeId: item.exemplarYoutubeId,
            opportunityScore: item.opportunityScore,
            sourceChannel: item.sourceChannel,
            topic: item.topic,
          }))
      );
    }
  }

  const rows: Array<{
    excerpt: string | null;
    itemType: string;
    metadata: JsonObject;
    score: number | null;
    sourceChannelSlug: string | null;
    sourceVectorId: string | null;
    sourceYoutubeId: string | null;
    title: string | null;
  }> = [
    ...(selectedOpportunity
      ? [
          {
            excerpt: `${selectedOpportunity.angle} ${selectedOpportunity.whyNow}`.trim(),
            itemType: "opportunity_brief",
            metadata: {
              opportunityId: selectedOpportunity.id,
              opportunityType: selectedOpportunity.opportunityType,
              rationale: selectedOpportunity.rationale,
              recommendedDuration: selectedOpportunity.recommendedDuration,
              recommendedFormat: selectedOpportunity.recommendedFormat,
              recommendedHook: selectedOpportunity.recommendedHook,
              thumbnailDirection: selectedOpportunity.thumbnailDirection,
            },
            score: 1000,
            sourceChannelSlug: selectedOpportunity.channelSlug,
            sourceVectorId: null,
            sourceYoutubeId: null,
            title: selectedOpportunity.title,
          },
        ]
      : []),
    ...(selectedOpportunity
      ? selectedOpportunity.channelEvidence.slice(0, 3).map((item, index) => ({
          excerpt: item.detail,
          itemType: "channel_evidence",
          metadata: {
            href: item.href,
            supportingMetric: item.supportingMetric,
          },
          score: 940 - index * 20,
          sourceChannelSlug: project.channel_slug,
          sourceVectorId: null,
          sourceYoutubeId: null,
          title: item.title,
        }))
      : []),
    ...(selectedOpportunity
      ? selectedOpportunity.competitorEvidence.slice(0, 3).map((item, index) => ({
          excerpt: item.detail,
          itemType: "competitor_evidence",
          metadata: {
            href: item.href,
            supportingMetric: item.supportingMetric,
          },
          score: 880 - index * 20,
          sourceChannelSlug: null,
          sourceVectorId: null,
          sourceYoutubeId: null,
          title: item.title,
        }))
      : []),
    ...quoteItems.map((item, index) => ({
      excerpt: item.snippet,
      itemType: "quote",
      metadata: {
        performanceTier: item.performanceTier,
        timestampLabel: item.timestampLabel,
        videoTitle: item.title,
        videoUrl: item.videoUrl,
        viewCount: item.viewCount,
      },
      score:
        selectedOpportunity && researchTokens.length > 0
          ? 780 -
            index * 20 +
            scoreOpportunityTextOverlap(`${item.title} ${item.snippet}`, researchTokens) * 5
          : item.score ?? null,
      sourceChannelSlug: item.channelSlug,
      sourceVectorId: item.vectorId,
      sourceYoutubeId: item.youtubeId,
      title: item.title,
    })),
    ...prioritizedHooks.map((hook, index) => ({
      excerpt: hook.text,
      itemType: "hook",
      metadata: {
        hookType: hook.hookType,
        timestampLabel: hook.timestampLabel,
        videoTitle: hook.videoTitle,
        videoUrl: hook.videoUrl,
        viewCount: hook.viewCount,
      },
      score: selectedOpportunity ? 620 - index * 20 : hook.viewCount,
      sourceChannelSlug: project.channel_slug,
      sourceVectorId: null,
      sourceYoutubeId: hook.youtubeId,
      title: hook.videoTitle,
    })),
    ...personaSamples.slice(0, selectedOpportunity ? 2 : 3).map((sample, index) => ({
      excerpt: sample.content,
      itemType: "persona_style",
      metadata: {
        baseModel: personaModel?.base_model ?? null,
        personaModelId: personaModel?.id ?? null,
        prompt: sample.prompt,
        source: sample.source,
      },
      score: selectedOpportunity ? 120 - index * 5 : 40 - index,
      sourceChannelSlug: project.channel_slug,
      sourceVectorId: null,
      sourceYoutubeId: null,
      title: sample.title,
    })),
    ...prioritizedTopicClusters.map((topic, index) => ({
      excerpt: `Average views ${topic.averageViews.toLocaleString()} across ${topic.videoCount} videos.`,
      itemType: "topic_cluster",
      metadata: {
        averageEngagementRate: topic.averageEngagementRate,
        exemplarVideoUrl: topic.exemplarVideoUrl,
        shareOfChannel: topic.shareOfChannel,
        topVideoTitle: topic.topVideoTitle,
      },
      score: selectedOpportunity ? 520 - index * 20 : topic.averageViews,
      sourceChannelSlug: project.channel_slug,
      sourceVectorId: null,
      sourceYoutubeId: topic.topVideoYoutubeId,
      title: topic.topic,
    })),
    ...(!selectedOpportunity
      ? gapItems
          .sort((left, right) => right.opportunityScore - left.opportunityScore)
          .slice(0, 4)
          .map((item) => ({
            excerpt: `${item.sourceChannel} is winning on ${item.topic} with ${Math.round(item.averageViews).toLocaleString()} average views.`,
            itemType: "gap",
            metadata: {
              exemplarTitle: item.exemplarTitle,
              exemplarVideoUrl: item.exemplarVideoUrl,
              opportunityScore: item.opportunityScore,
            },
            score: item.opportunityScore,
            sourceChannelSlug: item.sourceChannel,
            sourceVectorId: null,
            sourceYoutubeId: item.exemplarYoutubeId,
            title: item.topic,
          }))
      : []),
  ];

  await env.DB.prepare(`DELETE FROM script_research_items WHERE project_id = ?`).bind(project.id).run();

  const createdAt = new Date().toISOString();
  const inserts = rows.map((row) =>
    env.DB.prepare(
      `
        INSERT INTO script_research_items (
          id,
          project_id,
          item_type,
          source_channel_slug,
          source_youtube_id,
          source_vector_id,
          title,
          excerpt,
          score,
          metadata_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).bind(
      crypto.randomUUID(),
      project.id,
      row.itemType,
      row.sourceChannelSlug,
      row.sourceYoutubeId,
      row.sourceVectorId,
      row.title,
      row.excerpt,
      row.score,
      JSON.stringify(row.metadata),
      createdAt
    )
  );

  if (inserts.length > 0) {
    await env.DB.batch(inserts);
  }

  await touchScriptProject(project.id, env);
  return listScriptResearchItems(project.id, env);
}

async function buildScriptResearch(
  projectId: string,
  _request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const project = await findScriptProjectRow(projectId, context, env);
  if (!project) return jsonResponse({ error: "Script project not found" }, 404);

  const researchItems = await rebuildScriptResearch(project, context, env);
  const detail = await loadScriptProjectDetail(projectId, context, env);

  return jsonResponse({
    count: researchItems.length,
    project: detail,
    researchItems,
  });
}

async function generateScriptProjectOutput(
  projectId: string,
  request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const project = await findScriptProjectRow(projectId, context, env);
  if (!project) return jsonResponse({ error: "Script project not found" }, 404);
  if (!project.channel_slug) {
    return jsonResponse({ error: "Attach a channel before generating Script Lab outputs" }, 400);
  }

  const payload = await readJsonBody<Record<string, unknown>>(request);
  const rawStep = String(payload?.step ?? "").trim();
  if (!isScriptLabStep(rawStep)) {
    return jsonResponse({ error: "A valid Script Lab step is required" }, 400);
  }

  const analytics = await getChannelAnalytics(project.channel_slug, context, env);
  if (!analytics) return jsonResponse({ error: "Channel not found" }, 404);

  const [researchItems, outputs, thumbnailBriefs, topHooks] = await Promise.all([
    listScriptResearchItems(projectId, env),
    listScriptOutputs(projectId, env),
    listThumbnailBriefs(projectId, env),
    fetchHooks(analytics.channel.id, env, { limit: 6, sort: "views" }),
  ]);
  const selectedPersonaModel = project.persona_model_id
    ? await findPersonaModelRow(project.persona_model_id, context, env)
    : null;
  const selectedOpportunity = parseChannelOpportunity(project.opportunity_json);

  const ensuredResearch =
    researchItems.length > 0 ? researchItems : await rebuildScriptResearch(project, context, env);
  const generatorContext = {
    channelName: analytics.channel.channel_name,
    channelSlug: analytics.channel.slug,
    existingOutputs: outputs,
    opportunity: selectedOpportunity,
    projectTitle: project.title,
    researchItems: ensuredResearch,
    topic: project.topic,
    topicClusters: analytics.topicClusters,
    topHooks,
  };

  const manualContent = String(payload?.content ?? "").trim();
  const fallbackGenerated = generateScriptLabStep(rawStep, generatorContext);
  const aiGenerated =
    manualContent || !AI_SCRIPT_LAB_STEPS.has(rawStep)
      ? null
      : await maybeGenerateScriptLabStepWithAi(
          rawStep,
          generatorContext,
          ensuredResearch,
          selectedPersonaModel,
          topHooks,
          env
        );
  const generated = manualContent
    ? { content: manualContent, metadata: { source: "manual" } }
    : aiGenerated ?? fallbackGenerated;
  const modelKey = manualContent
    ? "manual"
    : aiGenerated
      ? aiGenerated.modelKey
    : selectedPersonaModel
      ? "persona-template-v1"
      : "retrieval-template-v1";
  const metadata = {
    ...generated.metadata,
    personaModelId: selectedPersonaModel?.id ?? null,
    personaModelBase: selectedPersonaModel?.base_model ?? null,
    topic: project.topic,
  };
  const thumbnailReferenceVideos = [...analytics.videos]
    .sort((left, right) => right.viewCount - left.viewCount)
    .slice(0, 6)
    .map((video) => ({
      thumbnailUrl: `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      title: video.title,
      viewCount: video.viewCount,
      youtubeId: video.youtubeId,
    }));
  const latestScriptOutput = outputs
    .filter((output) => output.step === "script")
    .sort((left, right) => right.version - left.version)[0];
  const latestDirectorNotes = outputs
    .filter((output) => output.step === "director_notes")
    .sort((left, right) => right.version - left.version)[0];
  const latestThumbnailBrief = thumbnailBriefs[0] ?? null;

  let generationJobId: string | null = null;

  if (rawStep === "thumbnail_brief") {
    const nextVersion = await getNextThumbnailBriefVersion(projectId, env);
    const briefId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      `
        INSERT INTO thumbnail_briefs (id, project_id, version, content, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        briefId,
        projectId,
        nextVersion,
        generated.content,
        JSON.stringify(metadata),
        createdAt
      )
      .run();

    const job = await createGenerationJob(
      {
        jobType: "thumbnail_images",
        message: "Queued thumbnail image generation",
        output: {},
        progress: 0,
        projectId,
        provider: "gemini",
        providerJobId: null,
        stage: "queued",
        status: "queued",
        input: {
          briefContent: generated.content,
          briefId,
          channelName: analytics.channel.channel_name,
          channelSlug: analytics.channel.slug,
          personaModelId: selectedPersonaModel?.id ?? null,
          projectTitle: project.title,
          referenceImages: thumbnailReferenceVideos,
          topic: project.topic,
        },
        personaModelId: selectedPersonaModel?.id ?? null,
      },
      context,
      env
    );
    generationJobId = job.id;
  } else {
    const nextVersion = await getNextScriptOutputVersion(projectId, rawStep, env);
    const outputId = crypto.randomUUID();
    await env.DB.prepare(
      `
        INSERT INTO script_outputs (
          id,
          project_id,
          step,
          version,
          model_key,
          content,
          metadata_json,
          created_by_user_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        outputId,
        projectId,
        rawStep,
        nextVersion,
        modelKey,
        generated.content,
        JSON.stringify(metadata),
        context.session.user.id,
        new Date().toISOString()
      )
      .run();

    if (rawStep === "previs") {
      const job = await createGenerationJob(
        {
          jobType: "previs",
          output: {},
          progress: 0,
          projectId,
          provider: "internal",
          providerJobId: null,
          stage: "queued",
          status: "queued",
          message: "Queued previsualization render",
          input: {
            briefOutputId: outputId,
            briefContent: generated.content,
            channelName: analytics.channel.channel_name,
            channelSlug: analytics.channel.slug,
            directorNotesContent: latestDirectorNotes?.content ?? "",
            personaModelId: selectedPersonaModel?.id ?? null,
            projectTitle: project.title,
            referenceImages: thumbnailReferenceVideos,
            scriptContent: latestScriptOutput?.content ?? "",
            thumbnailBriefContent: latestThumbnailBrief?.content ?? "",
            topic: project.topic,
          },
          personaModelId: selectedPersonaModel?.id ?? null,
        },
        context,
        env
      );
      generationJobId = job.id;
    }
  }

  await touchScriptProject(projectId, env);
  const detail = await loadScriptProjectDetail(projectId, context, env);

  return jsonResponse({
    generationJobId,
    project: detail,
    step: rawStep,
  });
}

async function listPersonaModels(context: RequestContext, env: Env): Promise<Response> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT ${PERSONA_MODEL_SELECT}
      FROM persona_models pm
      LEFT JOIN channels c ON c.id = pm.channel_id
      WHERE pm.workspace_id = ?
      ORDER BY pm.updated_at DESC, pm.created_at DESC
    `
  )
    .bind(context.workspace.id)
    .all<PersonaModelRow>();

  const response: PersonaModelListResponse = {
    items: results.map(toPersonaModelSummary),
    count: results.length,
  };

  return jsonResponse(response);
}

async function getPersonaModel(
  modelId: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const row = await findPersonaModelRow(modelId, context, env);
  if (!row) return jsonResponse({ error: "Persona model not found" }, 404);

  const detail: PersonaModelDetail = {
    ...toPersonaModelSummary(row),
    generationJobs: await listGenerationJobsForPersonaModel(modelId, context.workspace.id, env),
  };

  const response: PersonaModelResponse = { personaModel: detail };
  return jsonResponse(response);
}

async function createPersonaModel(
  request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const channelSlug =
    String(payload?.channelSlug ?? payload?.channel ?? env.DEFAULT_CHANNEL_SLUG ?? "").trim() || null;
  const baseModel =
    String(payload?.baseModel ?? "Qwen/Qwen2.5-7B-Instruct").trim() ||
    "Qwen/Qwen2.5-7B-Instruct";

  if (!channelSlug) {
    return jsonResponse({ error: "channelSlug is required" }, 400);
  }

  const channel = await findChannel(channelSlug, context, env);
  if (!channel) return jsonResponse({ error: "Channel not found" }, 404);

  const [topHooks, transcriptPassages] = await Promise.all([
    fetchHooks(channel.id, env, { limit: 120, sort: "views" }),
    fetchPersonaTranscriptPassages(channel.id, env),
  ]);

  const dataset = buildPersonaDatasetLines({
    channelName: channel.channel_name,
    channelSlug: channel.slug,
    topHooks,
    transcriptPassages,
  });

  const modelId = crypto.randomUUID();
  const datasetKey = `persona-datasets/${context.workspace.id}/${modelId}.jsonl`;
  if (env.ASSETS) {
    await env.ASSETS.put(datasetKey, `${dataset.lines.join("\n")}\n`, {
      httpMetadata: {
        contentType: "application/x-ndjson",
      },
    });
  }

  let launchPlanMetadata: JsonObject = {};
  try {
    const launchPlan = await resolveLambdaLaunchPlan(env);
    launchPlanMetadata = {
      lambdaLaunchPlan: launchPlan,
      estimatedCostUsdPerHour:
        launchPlan.priceCentsPerHour === null
          ? null
          : Number((launchPlan.priceCentsPerHour / 100).toFixed(2)),
    };
  } catch (error) {
    launchPlanMetadata = {
      lambdaLaunchPlanError: error instanceof Error ? error.message : "Unable to resolve Lambda launch plan.",
    };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `
      INSERT INTO persona_models (
        id,
        workspace_id,
        channel_id,
        status,
        provider,
        provider_job_id,
        base_model,
        adapter_path,
        dataset_path,
        dataset_examples,
        metadata_json,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'draft', 'lambda', NULL, ?, NULL, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      modelId,
      context.workspace.id,
      channel.id,
      baseModel,
      env.ASSETS ? `assets://${datasetKey}` : datasetKey,
      dataset.exampleCount,
      JSON.stringify({
        ...dataset.metadata,
        ...launchPlanMetadata,
        channelName: channel.channel_name,
      }),
      context.session.user.id,
      now,
      now
    )
    .run();

  return getPersonaModel(modelId, context, env);
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function buildPersonaTrainingUserData(params: {
  apiBaseUrl: string;
  baseModel: string;
  hfApiToken?: string | null;
  jobId: string;
  leaseToken: string;
  rawBaseUrl: string;
}): string {
  const hfFlag = params.hfApiToken?.trim()
    ? '  --hf-api-token "${HF_API_TOKEN}"'
    : "";
  const commandLines = [
    "python train_persona.py \\",
    '  --api-base-url "${API_BASE_URL}" \\',
    '  --job-id "${JOB_ID}" \\',
    '  --lease-token "${LEASE_TOKEN}" \\',
    `  --base-model "\${BASE_MODEL}"${hfFlag ? " \\\n" + hfFlag : ""}`,
  ];
  const lines = [
    "#!/bin/bash",
    "set -euo pipefail",
    `API_BASE_URL=${shellEscape(params.apiBaseUrl)}`,
    `BASE_MODEL=${shellEscape(params.baseModel)}`,
    `JOB_ID=${shellEscape(params.jobId)}`,
    `LEASE_TOKEN=${shellEscape(params.leaseToken)}`,
    `RAW_BASE_URL=${shellEscape(params.rawBaseUrl.replace(/\/+$/, ""))}`,
    `HF_API_TOKEN=${shellEscape(params.hfApiToken?.trim() || "")}`,
    "notify_fail() {",
    "  curl -fsSL -X POST \"${API_BASE_URL}/api/callback/generation-jobs/${JOB_ID}/fail\" \\",
    "    -H 'content-type: application/json' \\",
    "    -H \"x-generation-lease-token: ${LEASE_TOKEN}\" \\",
    "    --data '{\"stage\":\"failed\",\"message\":\"Lambda bootstrap failed before training could start.\"}' >/dev/null 2>&1 || true",
    "}",
    "trap notify_fail ERR",
    "apt-get update",
    "DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv ffmpeg zip curl git",
    "mkdir -p /opt/ytscan-persona",
    "cd /opt/ytscan-persona",
    "curl -fsSL \"${RAW_BASE_URL}/infrastructure/lambda/persona/requirements.txt\" -o requirements.txt",
    "curl -fsSL \"${RAW_BASE_URL}/infrastructure/lambda/persona/train_persona.py\" -o train_persona.py",
    "python3 -m venv .venv",
    "source .venv/bin/activate",
    "python -m pip install --upgrade pip wheel setuptools",
    "python -m pip install --extra-index-url https://download.pytorch.org/whl/cu124 torch torchvision torchaudio",
    "python -m pip install -r requirements.txt",
    ...commandLines,
  ];

  return `${lines.join("\n")}\n`;
}

async function trainPersonaModel(
  modelId: string,
  request: Request,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const personaModel = await findPersonaModelRow(modelId, context, env);
  if (!personaModel) return jsonResponse({ error: "Persona model not found" }, 404);

  const payload = await readJsonBody<Record<string, unknown>>(request);
  const launchInstance = parseBoolean(payload?.launchInstance, false);
  const apiBaseUrl = new URL(request.url).origin.replace(/\/+$/, "");
  const rawBaseUrl =
    env.LAMBDA_TRAINING_REPO_RAW_BASE?.trim().replace(/\/+$/, "") ||
    "https://raw.githubusercontent.com/zouantchaw/ytscan/main";

  let launchPlan;
  try {
    launchPlan = await resolveLambdaLaunchPlan(env, {
      instanceTypeName:
        payload?.instanceTypeName === undefined || payload?.instanceTypeName === null
          ? null
          : String(payload.instanceTypeName),
      regionName:
        payload?.regionName === undefined || payload?.regionName === null
          ? null
          : String(payload.regionName),
      sshKeyNames: Array.isArray(payload?.sshKeyNames)
        ? payload.sshKeyNames.map((value) => String(value))
        : null,
    });
  } catch (error) {
    if (launchInstance) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Unable to plan Lambda launch" }, 400);
    }
    launchPlan = null;
  }

  const callbackLeaseToken = crypto.randomUUID();
  const callbackLeaseExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const job = await createGenerationJob(
    {
      jobType: "persona_train",
      output: {},
      progress: launchInstance ? 0.05 : 0,
      projectId: null,
      provider: "lambda",
      providerJobId: null,
      status: launchInstance ? "provisioning" : "queued",
      stage: launchInstance ? "provisioning" : "queued",
      input: {
        apiBaseUrl,
        baseModel: personaModel.base_model,
        callbackLeaseExpiresAt,
        channelSlug: personaModel.channel_slug,
        datasetPath: personaModel.dataset_path,
        hfTokenConfigured: Boolean(env.HF_API_TOKEN?.trim()),
        launchInstance,
        launchPlan,
        rawBaseUrl,
      },
      personaModelId: personaModel.id,
    },
    context,
    env
  );

  await env.DB.prepare(
    `
      UPDATE generation_jobs
      SET lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ?
    `
  )
    .bind(callbackLeaseToken, callbackLeaseExpiresAt, new Date().toISOString(), job.id, context.workspace.id)
    .run();

  let nextStatus = launchInstance ? "training" : "queued";
  let providerJobId: string | null = null;
  let errorMessage: string | null = null;

  if (launchInstance && launchPlan) {
    try {
      const launchResult = await launchLambdaInstance(env, {
        ...launchPlan,
        name: `ytscan-${(personaModel.channel_slug ?? "model").slice(0, 24)}-${personaModel.id.slice(0, 8)}`,
        userData: buildPersonaTrainingUserData({
          apiBaseUrl,
          baseModel: personaModel.base_model,
          hfApiToken: env.HF_API_TOKEN ?? null,
          jobId: job.id,
          leaseToken: callbackLeaseToken,
          rawBaseUrl,
        }),
      });

      providerJobId = launchResult.instanceIds[0] ?? null;
      const now = new Date().toISOString();
      await env.DB.prepare(
        `
          UPDATE generation_jobs
          SET
            provider_job_id = ?,
            status = 'running',
            stage = 'training',
            progress = ?,
            output_json = ?,
            message = ?,
            started_at = COALESCE(started_at, ?),
            updated_at = ?
          WHERE id = ? AND workspace_id = ?
        `
      )
        .bind(
          providerJobId,
          0.12,
          JSON.stringify({
            callbackLeaseExpiresAt,
            launchPlan,
            launchResult: launchResult.raw,
          }),
          "Provisioned Lambda instance and started persona training bootstrap",
          now,
          now,
          job.id,
          context.workspace.id
        )
        .run();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Lambda launch failed";
      nextStatus = "failed";
      const failedAt = new Date().toISOString();
      await env.DB.prepare(
        `
          UPDATE generation_jobs
          SET
            status = 'failed',
            stage = 'failed',
            message = ?,
            error_message = ?,
            output_json = ?,
            lease_token = NULL,
            lease_expires_at = NULL,
            completed_at = ?,
            updated_at = ?
          WHERE id = ? AND workspace_id = ?
        `
      )
        .bind(
          errorMessage,
          errorMessage,
          JSON.stringify({
            launchPlan,
          }),
          failedAt,
          failedAt,
          job.id,
          context.workspace.id
        )
        .run();
    }
  }

  await env.DB.prepare(
    `
      UPDATE persona_models
      SET status = ?, provider_job_id = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ?
    `
  )
    .bind(nextStatus, providerJobId, new Date().toISOString(), personaModel.id, context.workspace.id)
    .run();

  const detail = await getPersonaModel(modelId, context, env);
  if (!errorMessage) return detail;

  return new Response(detail.body, {
    headers: detail.headers,
    status: 202,
  });
}

async function getGenerationJob(
  jobId: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  const row = await env.DB.prepare(
    `
      SELECT ${GENERATION_JOB_SELECT}
      FROM generation_jobs
      WHERE id = ? AND workspace_id = ?
      LIMIT 1
    `
  )
    .bind(jobId, context.workspace.id)
    .first<GenerationJobRow>();

  if (!row) return jsonResponse({ error: "Generation job not found" }, 404);
  return jsonResponse({ job: toGenerationJobSummary(row) });
}

async function getGenerationAsset(
  assetId: string,
  context: RequestContext,
  env: Env
): Promise<Response> {
  if (!env.ASSETS) {
    return jsonResponse({ error: "ASSETS bucket binding is not configured" }, 500);
  }

  const row = await env.DB.prepare(
    `
      SELECT ${GENERATION_ASSET_SELECT}
      FROM generation_assets
      WHERE id = ? AND workspace_id = ?
      LIMIT 1
    `
  )
    .bind(assetId, context.workspace.id)
    .first<GenerationAssetRow>();

  if (!row) return jsonResponse({ error: "Asset not found" }, 404);

  const object = await env.ASSETS.get(row.r2_key);
  if (!object) return jsonResponse({ error: "Asset blob not found" }, 404);

  const headers = new Headers();
  headers.set("content-type", row.mime_type);
  headers.set("cache-control", "private, max-age=60");
  headers.set(
    "content-disposition",
    `${row.mime_type.startsWith("video/") ? "inline" : "inline"}; filename="${row.file_name.replace(/"/g, "")}"`
  );
  if (row.byte_size !== null) {
    headers.set("content-length", String(row.byte_size));
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

async function listWorkspaceChannelRows(
  context: RequestContext,
  env: Env
): Promise<ChannelRow[]> {
  const { results = [] } = await env.DB.prepare(
    `SELECT ${CHANNEL_SELECT} FROM channels WHERE workspace_id = ? ORDER BY channel_name ASC`
  )
    .bind(context.workspace.id)
    .all<ChannelRow>();

  return results;
}

async function getNextScriptOutputVersion(
  projectId: string,
  step: string,
  env: Env
): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(MAX(version), 0) AS value FROM script_outputs WHERE project_id = ? AND step = ?`
  )
    .bind(projectId, step)
    .first<{ value: number }>();

  return Number(row?.value ?? 0) + 1;
}

async function getNextThumbnailBriefVersion(projectId: string, env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(MAX(version), 0) AS value FROM thumbnail_briefs WHERE project_id = ?`
  )
    .bind(projectId)
    .first<{ value: number }>();

  return Number(row?.value ?? 0) + 1;
}

async function touchScriptProject(projectId: string, env: Env): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE script_projects SET updated_at = ? WHERE id = ?`).bind(now, projectId).run();
}

async function createGenerationJob(
  params: {
    input: JsonObject;
    jobType: string;
    message?: string | null;
    output: JsonObject;
    personaModelId: string | null;
    progress: number;
    projectId: string | null;
    provider: string;
    providerJobId: string | null;
    stage?: string;
    status: string;
  },
  context: RequestContext,
  env: Env
): Promise<GenerationJobSummary> {
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `
      INSERT INTO generation_jobs (
        id,
        workspace_id,
        project_id,
        persona_model_id,
        job_type,
        provider,
        provider_job_id,
        status,
        stage,
        progress,
        input_json,
        output_json,
        message,
        error_message,
        created_by_user_id,
        started_at,
        completed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?)
    `
  )
    .bind(
      jobId,
      context.workspace.id,
      params.projectId,
      params.personaModelId,
      params.jobType,
      params.provider,
      params.providerJobId,
      params.status,
      params.stage ?? "queued",
      params.progress,
      JSON.stringify(params.input),
      JSON.stringify(params.output),
      compactMessage(params.message),
      context.session.user.id,
      now,
      now
    )
    .run();

  return {
    id: jobId,
    projectId: params.projectId,
    personaModelId: params.personaModelId,
    jobType: params.jobType,
    provider: params.provider,
    providerJobId: params.providerJobId,
    status: params.status,
    stage: params.stage ?? "queued",
    progress: params.progress,
    input: params.input,
    output: params.output,
    message: compactMessage(params.message),
    errorMessage: null,
    createdByUserId: context.session.user.id,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function fetchPersonaTranscriptPassages(
  channelId: number,
  env: Env
): Promise<Array<{ text: string; title: string; youtubeId: string }>> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT
        tc.text,
        v.title,
        v.youtube_id
      FROM transcript_chunks tc
      JOIN videos v ON v.id = tc.video_id
      WHERE v.channel_id = ?
      ORDER BY v.view_count DESC, tc.chunk_index ASC
      LIMIT 900
    `
  )
    .bind(channelId)
    .all<Record<string, unknown>>();

  return results
    .map((row) => ({
      text: dedupeRepeatedPhrases(String(row.text ?? "")),
      title: String(row.title ?? ""),
      youtubeId: String(row.youtube_id ?? ""),
    }))
    .filter((item) => item.text.length >= 120 && item.text.length <= 1400);
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
  const searchTerms = buildTextSearchTerms(query);
  if (searchTerms.length === 0) return [];

  const likeClauses = searchTerms.flatMap(() => [
    "LOWER(tc.text) LIKE ? ESCAPE '\\'",
    "LOWER(v.title) LIKE ? ESCAPE '\\'",
    "LOWER(v.description) LIKE ? ESCAPE '\\'",
  ]);
  const likeBinds = searchTerms.flatMap((term) => {
    const pattern = `%${escapeLikePattern(term)}%`;
    return [pattern, pattern, pattern];
  });
  const { clauses, binds } = buildSearchFilterClause(filters, context.workspace.id);
  const whereClauses = [`(${likeClauses.join(" OR ")})`, ...clauses];
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
    .bind(...likeBinds, ...binds, limit)
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
    `SELECT ${VIDEO_SELECT}
     FROM videos v
     LEFT JOIN thumbnail_analyses ta ON ta.video_id = v.id
     WHERE v.channel_id = ?
     ORDER BY v.upload_date DESC`
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
    thumbnailAnalysis: toThumbnailAnalysisSummary(row),
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
      thumbnailAnalysis: video.thumbnailAnalysis,
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
