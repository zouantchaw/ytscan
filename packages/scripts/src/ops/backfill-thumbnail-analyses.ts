import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import {
  analyzeThumbnail,
  loadThumbnailAnalysisCache,
  persistThumbnailAnalysisCache,
  type ThumbnailAnalysisRecord,
} from "../lib/thumbnail-analysis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../../");
const WRANGLER_CONFIG = path.resolve(MONOREPO_ROOT, "apps/api/wrangler.toml");
const D1_DATABASE = process.env.CLOUDFLARE_D1_DATABASE || "ytscan";
const wranglerCommand =
  process.platform === "win32"
    ? path.resolve(MONOREPO_ROOT, "node_modules/.bin/wrangler.cmd")
    : path.resolve(MONOREPO_ROOT, "node_modules/.bin/wrangler");

dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env") });

type VideoRow = {
  channel_name: string;
  thumbnail_path: string;
  title: string;
  video_id: number;
  youtube_id: string;
};

function sqlValue(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

async function runCommand(command: string, args: string[]): Promise<string> {
  const { execFile } = await import("node:child_process");

  return await new Promise<string>((resolve, reject) => {
    execFile(command, args, { cwd: MONOREPO_ROOT, env: process.env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }

      resolve(stdout);
    });
  });
}

async function d1ExecuteSql(sql: string): Promise<any> {
  const stdout = await runCommand(wranglerCommand, [
    "d1",
    "execute",
    D1_DATABASE,
    "--remote",
    "--yes",
    "--json",
    "--config",
    WRANGLER_CONFIG,
    "--command",
    sql,
  ]);

  return JSON.parse(stdout)[0];
}

async function d1ExecuteFile(filePath: string): Promise<void> {
  await runCommand(wranglerCommand, [
    "d1",
    "execute",
    D1_DATABASE,
    "--remote",
    "--yes",
    "--config",
    WRANGLER_CONFIG,
    "--file",
    filePath,
  ]);
}

async function fetchChannelVideos(channelSlug: string): Promise<VideoRow[]> {
  const result = await d1ExecuteSql(`
    SELECT
      v.id AS video_id,
      v.youtube_id,
      v.title,
      c.channel_name,
      COALESCE(v.thumbnail_path, '') AS thumbnail_path
    FROM videos v
    JOIN channels c ON c.id = v.channel_id
    WHERE c.slug = ${sqlValue(channelSlug)}
    ORDER BY v.view_count DESC, v.upload_date DESC;
  `);

  return (result.results ?? []) as VideoRow[];
}

function buildUpsertSql(video: VideoRow, analysis: ThumbnailAnalysisRecord): string {
  return `
    INSERT INTO thumbnail_analyses (
      id,
      video_id,
      provider,
      model_key,
      text_overlay,
      text_overlay_present,
      text_position,
      text_size,
      has_face,
      face_count,
      expression,
      dominant_colors,
      composition_style,
      primary_subject,
      objects_json,
      visual_hook,
      why_it_works,
      clarity_score,
      analysis_json,
      created_at,
      updated_at
    ) VALUES (
      ${sqlValue(`backfill:${video.youtube_id}`)},
      ${sqlValue(video.video_id)},
      ${sqlValue(analysis.provider)},
      ${sqlValue(analysis.modelKey)},
      ${sqlValue(analysis.textOverlay)},
      ${sqlValue(analysis.textOverlayPresent ? 1 : 0)},
      ${sqlValue(analysis.textPosition)},
      ${sqlValue(analysis.textSize)},
      ${sqlValue(analysis.hasFace ? 1 : 0)},
      ${sqlValue(analysis.faceCount)},
      ${sqlValue(analysis.expression)},
      ${sqlValue(JSON.stringify(analysis.dominantColors))},
      ${sqlValue(analysis.compositionStyle)},
      ${sqlValue(analysis.primarySubject)},
      ${sqlValue(JSON.stringify(analysis.objects))},
      ${sqlValue(analysis.visualHook)},
      ${sqlValue(analysis.whyItWorks)},
      ${sqlValue(analysis.clarityScore)},
      ${sqlValue(JSON.stringify(analysis))},
      ${sqlValue(new Date().toISOString())},
      ${sqlValue(new Date().toISOString())}
    )
    ON CONFLICT(video_id) DO UPDATE SET
      provider = excluded.provider,
      model_key = excluded.model_key,
      text_overlay = excluded.text_overlay,
      text_overlay_present = excluded.text_overlay_present,
      text_position = excluded.text_position,
      text_size = excluded.text_size,
      has_face = excluded.has_face,
      face_count = excluded.face_count,
      expression = excluded.expression,
      dominant_colors = excluded.dominant_colors,
      composition_style = excluded.composition_style,
      primary_subject = excluded.primary_subject,
      objects_json = excluded.objects_json,
      visual_hook = excluded.visual_hook,
      why_it_works = excluded.why_it_works,
      clarity_score = excluded.clarity_score,
      analysis_json = excluded.analysis_json,
      updated_at = excluded.updated_at;
  `;
}

async function backfillChannel(channelSlug: string): Promise<void> {
  const videos = await fetchChannelVideos(channelSlug);
  if (!videos.length) {
    throw new Error(`No videos found in D1 for ${channelSlug}`);
  }

  const exportRoot = path.resolve(MONOREPO_ROOT, `data/channels/${channelSlug}/exports`);
  fs.mkdirSync(exportRoot, { recursive: true });
  const cachePath = path.join(exportRoot, `${channelSlug}.thumbnail-analysis.json`);
  const cache = loadThumbnailAnalysisCache(cachePath);
  const statements: string[] = [];

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    if (!video.thumbnail_path) continue;

    const thumbnailAbsolutePath = path.resolve(MONOREPO_ROOT, video.thumbnail_path);
    if (!fs.existsSync(thumbnailAbsolutePath)) {
      console.warn(`Skipping ${channelSlug}/${video.youtube_id}: thumbnail file missing at ${thumbnailAbsolutePath}`);
      continue;
    }

    const cached = cache.get(video.youtube_id);
    let analysis =
      cached?.sourceThumbnailPath === video.thumbnail_path
        ? cached.analysis
        : null;

    if (!analysis) {
      console.log(`[${channelSlug}] analyzing ${index + 1}/${videos.length}: ${video.title}`);
      analysis = await analyzeThumbnail({
        channelName: video.channel_name,
        thumbnailPath: thumbnailAbsolutePath,
        title: video.title,
      });

      cache.set(video.youtube_id, {
        analysis,
        analyzedAt: new Date().toISOString(),
        sourceThumbnailPath: video.thumbnail_path,
        youtubeId: video.youtube_id,
      });
      persistThumbnailAnalysisCache(cachePath, cache);
    }

    statements.push(buildUpsertSql(video, analysis));
  }
  const tempFile = path.join(os.tmpdir(), `ytscan-thumbnail-backfill-${channelSlug}-${Date.now()}.sql`);
  fs.writeFileSync(tempFile, `${statements.join("\n")}\n`);

  try {
    await d1ExecuteFile(tempFile);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }

  console.log(`[${channelSlug}] backfill complete for ${videos.length} videos`);
}

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY is required for thumbnail backfill.");
  }

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "channel-slug": { type: "string" },
    },
  });

  const slugs = String(values["channel-slug"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!slugs.length) {
    throw new Error("Provide --channel-slug codie-sanchez,johnnyharris");
  }

  for (const slug of slugs) {
    await backfillChannel(slug);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
