import type { Ai, VectorizeIndex } from "@cloudflare/workers-types";
import type {
  ChannelDashboard,
  ChannelSummary,
  HookSummary,
  SearchResponse,
  SearchResultItem,
  VideoSummary,
} from "@ytscan/core";

type Env = {
  DB: D1Database;
  AI?: Ai;
  TRANSCRIPTS_INDEX?: VectorizeIndex;
  DEFAULT_CHANNEL_SLUG?: string;
};

const CORS_HEADERS: HeadersInit = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

const JSON_HEADERS: HeadersInit = {
  "content-type": "application/json; charset=utf-8",
  ...CORS_HEADERS,
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);

    try {
      if (pathname === "/" || pathname === "/health") {
        return jsonResponse({
          status: "ok",
          service: "ytscan-api",
          defaultChannel: env.DEFAULT_CHANNEL_SLUG ?? null,
        });
      }

      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      if (pathname === "/api/channels") {
        return listChannels(env);
      }

      if (pathname.startsWith("/api/channels/")) {
        const slug = decodeURIComponent(pathname.slice("/api/channels/".length));
        if (!slug) return jsonResponse({ error: "Channel slug is required" }, 400);
        return getChannelDashboard(slug, env);
      }

      if (pathname === "/api/search") {
        return handleSearch(url, env);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      console.error("Unhandled worker error", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
};

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

function clampLimit(rawValue: string | null, fallback: number, max: number): number {
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function buildVideoUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

function buildTimestampLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  if (hours > 0) {
    return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, "0")).join(":");
  }
  return [minutes, remainingSeconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function buildSnippet(text: string, maxLength = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();
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

async function listChannels(env: Env): Promise<Response> {
  const { results = [] } = await env.DB.prepare(
    `SELECT ${CHANNEL_SELECT} FROM channels ORDER BY scan_date DESC, channel_name ASC`
  ).all<Record<string, unknown>>();

  const items: ChannelSummary[] = results.map((row) => ({
    slug: String(row.slug),
    channelName: String(row.channel_name),
    channelUrl: String(row.channel_url),
    channelYoutubeId: row.channel_youtube_id ? String(row.channel_youtube_id) : null,
    totalVideos: Number(row.total_videos ?? 0),
    subscriberCount: row.subscriber_count ? Number(row.subscriber_count) : null,
    scanDate: String(row.scan_date),
  }));

  return jsonResponse({ items, count: items.length });
}

async function getChannelDashboard(slug: string, env: Env): Promise<Response> {
  const channel = await env.DB.prepare(
    `SELECT ${CHANNEL_SELECT} FROM channels WHERE slug = ? LIMIT 1`
  )
    .bind(slug)
    .first<Record<string, unknown>>();

  if (!channel) {
    return jsonResponse({ error: "Channel not found" }, 404);
  }

  const { results: topVideoRows = [] } = await env.DB.prepare(
    `
      SELECT youtube_id, title, upload_date, duration_sec, view_count, like_count, comment_count, performance_tier
      FROM videos
      WHERE channel_id = ?
      ORDER BY view_count DESC, upload_date DESC
      LIMIT 10
    `
  )
    .bind(channel.id)
    .all<Record<string, unknown>>();

  const { results: hookRows = [] } = await env.DB.prepare(
    `
      SELECT h.text, h.start_time, h.end_time, h.word_count, h.hook_type, v.youtube_id, v.title, v.view_count
      FROM hooks h
      JOIN videos v ON v.id = h.video_id
      WHERE v.channel_id = ?
      ORDER BY v.view_count DESC, h.start_time ASC
      LIMIT 12
    `
  )
    .bind(channel.id)
    .all<Record<string, unknown>>();

  const { results: statRows = [] } = await env.DB.prepare(
    `
      SELECT
        COUNT(*) AS total_videos,
        COALESCE(SUM(view_count), 0) AS total_views,
        COALESCE(AVG(view_count), 0) AS average_views,
        COALESCE(SUM(duration_sec), 0) AS total_duration_sec
      FROM videos
      WHERE channel_id = ?
    `
  )
    .bind(channel.id)
    .all<Record<string, unknown>>();

  const { results: medianRows = [] } = await env.DB.prepare(
    `SELECT view_count FROM videos WHERE channel_id = ? ORDER BY view_count ASC`
  )
    .bind(channel.id)
    .all<Record<string, unknown>>();

  const topVideos: VideoSummary[] = topVideoRows.map((row) => ({
    youtubeId: String(row.youtube_id),
    title: String(row.title),
    uploadDate: String(row.upload_date),
    durationSec: Number(row.duration_sec ?? 0),
    viewCount: Number(row.view_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    performanceTier: String(row.performance_tier ?? "average"),
    videoUrl: buildVideoUrl(String(row.youtube_id)),
  }));

  const topHooks: HookSummary[] = hookRows.map((row) => ({
    text: String(row.text),
    startTime: Number(row.start_time ?? 0),
    endTime: Number(row.end_time ?? 0),
    timestampLabel: buildTimestampLabel(Number(row.start_time ?? 0)),
    wordCount: Number(row.word_count ?? 0),
    hookType: String(row.hook_type ?? "unknown"),
    youtubeId: String(row.youtube_id),
    videoTitle: String(row.title),
    viewCount: Number(row.view_count ?? 0),
    videoUrl: buildVideoUrl(String(row.youtube_id)),
  }));

  const statRow = statRows[0] ?? {};
  const sortedViews = medianRows
    .map((row) => Number(row.view_count ?? 0))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  const dashboard: ChannelDashboard = {
    slug: String(channel.slug),
    channelName: String(channel.channel_name),
    channelUrl: String(channel.channel_url),
    channelYoutubeId: channel.channel_youtube_id ? String(channel.channel_youtube_id) : null,
    totalVideos: Number(statRow.total_videos ?? 0),
    subscriberCount: channel.subscriber_count ? Number(channel.subscriber_count) : null,
    scanDate: String(channel.scan_date),
    totalViews: Number(statRow.total_views ?? 0),
    averageViews: Math.round(Number(statRow.average_views ?? 0)),
    medianViews: computeMedian(sortedViews),
    totalDurationSec: Number(statRow.total_duration_sec ?? 0),
    topVideos,
    topHooks,
  };

  return jsonResponse(dashboard);
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const midpoint = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return Math.round((values[midpoint - 1] + values[midpoint]) / 2);
  }
  return values[midpoint];
}

async function handleSearch(url: URL, env: Env): Promise<Response> {
  const query = url.searchParams.get("q")?.trim();
  if (!query) {
    return jsonResponse({ error: "Missing q query parameter" }, 400);
  }

  const channelSlug = url.searchParams.get("channel")?.trim() || env.DEFAULT_CHANNEL_SLUG || "";
  const mode = url.searchParams.get("mode")?.trim() || "semantic";
  const limit = clampLimit(url.searchParams.get("limit"), 10, 25);

  if (mode === "semantic") {
    const semantic = await runSemanticSearch(query, channelSlug, limit, env);
    if (semantic) {
      const response: SearchResponse = {
        items: semantic,
        count: semantic.length,
        mode: "semantic",
        channel: channelSlug || null,
        query,
      };
      return jsonResponse(response);
    }
  }

  const items = await runTextSearch(query, channelSlug, limit, env);
  const response: SearchResponse = {
    items,
    count: items.length,
    mode: "text",
    channel: channelSlug || null,
    query,
    fallbackUsed: mode === "semantic",
  };
  return jsonResponse(response);
}

async function runTextSearch(
  query: string,
  channelSlug: string,
  limit: number,
  env: Env
): Promise<SearchResultItem[]> {
  const queryPattern = `%${query.toLowerCase()}%`;
  const binds = channelSlug ? [channelSlug, queryPattern, limit] : [queryPattern, limit];
  const sql = channelSlug
    ? `
        SELECT ${SEARCH_SELECT}
        FROM transcript_chunks tc
        JOIN videos v ON v.id = tc.video_id
        JOIN channels c ON c.id = v.channel_id
        WHERE c.slug = ? AND LOWER(tc.text) LIKE ?
        ORDER BY v.view_count DESC, tc.start_time ASC
        LIMIT ?
      `
    : `
        SELECT ${SEARCH_SELECT}
        FROM transcript_chunks tc
        JOIN videos v ON v.id = tc.video_id
        JOIN channels c ON c.id = v.channel_id
        WHERE LOWER(tc.text) LIKE ?
        ORDER BY v.view_count DESC, tc.start_time ASC
        LIMIT ?
      `;

  const { results = [] } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
  return results.map(toSearchResultItem);
}

async function runSemanticSearch(
  query: string,
  channelSlug: string,
  limit: number,
  env: Env
): Promise<SearchResultItem[] | null> {
  if (!env.AI || !env.TRANSCRIPTS_INDEX) {
    return null;
  }

  try {
    const embeddingResponse = await env.AI.run("@cf/baai/bge-m3", { text: [query] });
    const embedding = extractEmbedding(embeddingResponse);
    if (!embedding) return null;

    const topK = Math.min(Math.max(limit * 3, limit), 50);
    const vectorResults = await env.TRANSCRIPTS_INDEX.query(embedding, {
      topK,
      returnMetadata: true,
      returnValues: false,
    });

    if (!vectorResults.matches?.length) return [];

    const vectorIds = vectorResults.matches.map((match) => match.id);
    const placeholders = vectorIds.map(() => "?").join(",");
    const binds = channelSlug ? [...vectorIds, channelSlug] : vectorIds;
    const sql = channelSlug
      ? `
          SELECT ${SEARCH_SELECT}
          FROM transcript_chunks tc
          JOIN videos v ON v.id = tc.video_id
          JOIN channels c ON c.id = v.channel_id
          WHERE tc.vector_id IN (${placeholders}) AND c.slug = ?
        `
      : `
          SELECT ${SEARCH_SELECT}
          FROM transcript_chunks tc
          JOIN videos v ON v.id = tc.video_id
          JOIN channels c ON c.id = v.channel_id
          WHERE tc.vector_id IN (${placeholders})
        `;

    const { results = [] } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    const rowMap = new Map<string, Record<string, unknown>>();
    for (const row of results) {
      rowMap.set(String(row.vector_id), row);
    }

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
    title: String(row.title),
    uploadDate: String(row.upload_date),
    viewCount: Number(row.view_count ?? 0),
    performanceTier: String(row.performance_tier ?? "average"),
    channelSlug: String(row.channel_slug),
    channelName: String(row.channel_name),
    videoUrl: buildVideoUrl(youtubeId),
    score,
  };
}
