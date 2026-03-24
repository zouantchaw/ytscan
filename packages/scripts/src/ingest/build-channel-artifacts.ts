import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import {
  analyzeThumbnail,
  loadThumbnailAnalysisCache,
  persistThumbnailAnalysisCache,
  THUMBNAIL_ANALYSIS_PROGRESS_PREFIX,
  type ThumbnailAnalysisRecord,
} from "../lib/thumbnail-analysis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../../");
const DEFAULT_CHANNEL_SLUG = "codie-sanchez";
const DEFAULT_SOURCE_ROOT = path.resolve(MONOREPO_ROOT, "data/channels/codie-sanchez/raw");
const DEFAULT_OUTPUT_ROOT = path.resolve(MONOREPO_ROOT, "data/channels/codie-sanchez/exports");
const WORDS_PER_CHUNK = 320;

dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env") });

type InfoJson = {
  id: string;
  title: string;
  channel?: string;
  channel_id?: string;
  channel_url?: string;
  webpage_url?: string;
  upload_date?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  description?: string;
  tags?: string[];
  channel_follower_count?: number;
};

type SrtEntry = {
  startTime: number;
  endTime: number;
  text: string;
};

type Segment = {
  startTime: number;
  endTime: number;
  text: string;
};

type ChunkRecord = {
  vectorId: string;
  youtubeId: string;
  title: string;
  uploadDate: string;
  viewCount: number;
  performanceTier: string;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  tokenCount: number;
  text: string;
};

type VideoArtifact = {
  youtubeId: string;
  title: string;
  uploadDate: string;
  durationSec: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  description: string;
  tagsJson: string;
  engagementRate: number;
  performanceTier: string;
  thumbnailPath: string;
  transcriptPath: string;
  sourcePath: string;
  hookText: string;
  hookWordCount: number;
  hookType: string;
  thumbnailAnalysis: ThumbnailAnalysisRecord | null;
  chunks: ChunkRecord[];
};

const sqlValue = (value: string | number | null): string => {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replace(/'/g, "''")}'`;
};

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeUploadDate(value: string | undefined): string {
  const normalized = (value ?? "").trim();
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }
  return normalized;
}

function stripCaptionNoise(value: string): string {
  return value
    .replace(/\[(?:music|applause|laughter|__+)\]/gi, " ")
    .replace(/♪+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSubtitleArtifacts(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/\b(?:subtitles|captions)\s+by\b[^.!\n]*/gi, " ")
    .replace(/>>+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeRepeatedPhrases(text: string): string {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  if (words.length === 0) return "";

  const result: string[] = [];
  let index = 0;

  while (index < words.length) {
    let matched = false;

    for (let size = 12; size >= 4; size -= 1) {
      const current = words.slice(index, index + size);
      const next = words.slice(index + size, index + size * 2);
      if (current.length !== size || next.length !== size) continue;

      const currentPhrase = current.join(" ").toLowerCase();
      const nextPhrase = next.join(" ").toLowerCase();
      if (currentPhrase !== nextPhrase) continue;

      result.push(...current);
      index += size * 2;
      matched = true;
      break;
    }

    if (matched) continue;

    result.push(words[index] ?? "");
    index += 1;
  }

  return normalizeWhitespace(result.join(" "));
}

function collapseRepeatedWords(text: string): string {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  if (words.length === 0) return "";

  const result: string[] = [];
  for (const word of words) {
    const previous = result.at(-1);
    if (
      previous &&
      previous.toLowerCase() === word.toLowerCase() &&
      word.length >= 3
    ) {
      continue;
    }
    result.push(word);
  }

  return normalizeWhitespace(result.join(" "));
}

function sanitizeTranscriptText(value: string): string {
  return collapseRepeatedWords(
    dedupeRepeatedPhrases(stripCaptionNoise(stripSubtitleArtifacts(value)))
  );
}

function timestampToSeconds(value: string): number {
  const match = value.match(/(\d+):(\d+):(\d+),(\d+)/);
  if (!match) return 0;
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis) / 1000;
}

function parseSrt(text: string): SrtEntry[] {
  const blocks = text.split(/\r?\n\r?\n/);
  const entries: SrtEntry[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const timestampLine = lines.find((line) => line.includes("-->"));
    if (!timestampLine) continue;
    const [startRaw, endRaw] = timestampLine.split("-->").map((value) => value.trim());
    const payload = lines.slice(lines.indexOf(timestampLine) + 1).join(" ");
    const normalizedText = sanitizeTranscriptText(payload);
    if (!normalizedText) continue;
    entries.push({
      startTime: timestampToSeconds(startRaw),
      endTime: timestampToSeconds(endRaw),
      text: normalizedText,
    });
  }

  return entries;
}

function dedupeRollingCaptions(entries: SrtEntry[]): Segment[] {
  const segments: Segment[] = [];
  let previous = "";

  const extractOverlapDelta = (previousText: string, currentText: string): string | null => {
    const previousWords = splitWords(previousText.toLowerCase());
    const currentWords = splitWords(currentText);
    const currentLowerWords = splitWords(currentText.toLowerCase());
    const maxOverlap = Math.min(previousWords.length, currentWords.length, 12);

    for (let size = maxOverlap; size >= 3; size -= 1) {
      const previousSuffix = previousWords.slice(-size).join(" ");
      const currentPrefix = currentLowerWords.slice(0, size).join(" ");
      if (previousSuffix !== currentPrefix) continue;

      const delta = normalizeWhitespace(currentWords.slice(size).join(" "));
      return delta || null;
    }

    return null;
  };

  for (const entry of entries) {
    const text = normalizeWhitespace(entry.text);
    if (!text) continue;

    if (text === previous) {
      continue;
    }

    if (previous && text.startsWith(previous)) {
      const delta = normalizeWhitespace(text.slice(previous.length));
      if (delta) {
        segments.push({
          startTime: entry.startTime,
          endTime: entry.endTime,
          text: delta,
        });
      }
      previous = text;
      continue;
    }

    const overlapDelta = previous ? extractOverlapDelta(previous, text) : null;
    if (overlapDelta) {
      segments.push({
        startTime: entry.startTime,
        endTime: entry.endTime,
        text: overlapDelta,
      });
      previous = text;
      continue;
    }

    if (previous && previous.startsWith(text)) {
      continue;
    }

    segments.push({
      startTime: entry.startTime,
      endTime: entry.endTime,
      text,
    });
    previous = text;
  }

  return segments;
}

function splitWords(text: string): string[] {
  return normalizeWhitespace(text).split(" ").filter(Boolean);
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(splitWords(text).length * 1.3));
}

function detectHookType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("?")) return "question";
  if (/\b\d+(\.\d+)?[%$mMkK]?\b/.test(text)) return "stat";
  if (/\b(i|we|my|our)\b/.test(lower)) return "story";
  return "shock";
}

function toPosixRelative(targetPath: string): string {
  return path.relative(MONOREPO_ROOT, targetPath).split(path.sep).join("/");
}

function pickPreferredFile(files: string[], predicates: Array<(fileName: string) => boolean>): string | undefined {
  for (const predicate of predicates) {
    const match = files.find(predicate);
    if (match) return match;
  }
  return undefined;
}

function computePerformanceTiers(videos: Array<{ youtubeId: string; viewCount: number }>): Map<string, string> {
  const sorted = [...videos].sort((left, right) => right.viewCount - left.viewCount);
  const viralCount = Math.max(1, Math.ceil(sorted.length * 0.1));
  const strongCount = Math.max(viralCount, Math.ceil(sorted.length * 0.25));
  const underperformStart = Math.max(0, sorted.length - Math.ceil(sorted.length * 0.25));
  const tiers = new Map<string, string>();

  sorted.forEach((video, index) => {
    let tier = "average";
    if (index < viralCount) {
      tier = "viral";
    } else if (index < strongCount) {
      tier = "strong";
    } else if (index >= underperformStart) {
      tier = "underperform";
    }
    tiers.set(video.youtubeId, tier);
  });

  return tiers;
}

function buildChunks(
  youtubeId: string,
  title: string,
  uploadDate: string,
  viewCount: number,
  performanceTier: string,
  segments: Segment[]
): ChunkRecord[] {
  const chunks: ChunkRecord[] = [];
  let currentWords: string[] = [];
  let currentStart = 0;
  let currentEnd = 0;
  let chunkIndex = 0;

  const flushChunk = () => {
    if (currentWords.length === 0) return;
    const text = sanitizeTranscriptText(currentWords.join(" "));
    if (!text) {
      currentWords = [];
      return;
    }
    chunks.push({
      vectorId: `${youtubeId}:${chunkIndex}`,
      youtubeId,
      title,
      uploadDate,
      viewCount,
      performanceTier,
      chunkIndex,
      startTime: currentStart,
      endTime: currentEnd,
      tokenCount: estimateTokenCount(text),
      text,
    });
    chunkIndex += 1;
    currentWords = [];
  };

  for (const segment of segments) {
    const words = splitWords(segment.text);
    if (words.length === 0) continue;

    if (currentWords.length === 0) {
      currentStart = segment.startTime;
    }

    currentWords.push(...words);
    currentEnd = segment.endTime;

    if (currentWords.length >= WORDS_PER_CHUNK) {
      flushChunk();
    }
  }

  flushChunk();
  return chunks;
}

function buildSql(
  channelSlug: string,
  channelName: string,
  channelUrl: string,
  channelYoutubeId: string | null,
  subscriberCount: number | null,
  scanDate: string,
  videos: VideoArtifact[]
): string {
  const lines: string[] = [];
  lines.push("PRAGMA foreign_keys = ON;");
  lines.push("");
  lines.push("DELETE FROM thumbnail_analyses WHERE video_id IN (");
  lines.push(`  SELECT id FROM videos WHERE channel_id IN (SELECT id FROM channels WHERE slug = ${sqlValue(channelSlug)})`);
  lines.push(");");
  lines.push("DELETE FROM transcript_chunks WHERE video_id IN (");
  lines.push(`  SELECT id FROM videos WHERE channel_id IN (SELECT id FROM channels WHERE slug = ${sqlValue(channelSlug)})`);
  lines.push(");");
  lines.push("DELETE FROM hooks WHERE video_id IN (");
  lines.push(`  SELECT id FROM videos WHERE channel_id IN (SELECT id FROM channels WHERE slug = ${sqlValue(channelSlug)})`);
  lines.push(");");
  lines.push(`DELETE FROM videos WHERE channel_id IN (SELECT id FROM channels WHERE slug = ${sqlValue(channelSlug)});`);
  lines.push(`DELETE FROM channels WHERE slug = ${sqlValue(channelSlug)};`);
  lines.push("");
  lines.push(
    `INSERT INTO channels (slug, channel_url, channel_name, channel_youtube_id, total_videos, subscriber_count, scan_date) VALUES (${sqlValue(
      channelSlug
    )}, ${sqlValue(channelUrl)}, ${sqlValue(channelName)}, ${sqlValue(channelYoutubeId)}, ${sqlValue(videos.length)}, ${sqlValue(
      subscriberCount
    )}, ${sqlValue(scanDate)});`
  );
  lines.push("");

  for (const video of videos) {
    lines.push(
      `INSERT INTO videos (
  channel_id,
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
  performance_tier,
  thumbnail_path,
  transcript_path,
  source_path
) VALUES (
  (SELECT id FROM channels WHERE slug = ${sqlValue(channelSlug)}),
  ${sqlValue(video.youtubeId)},
  ${sqlValue(video.title)},
  ${sqlValue(video.uploadDate)},
  ${sqlValue(video.durationSec)},
  ${sqlValue(video.viewCount)},
  ${sqlValue(video.likeCount)},
  ${sqlValue(video.commentCount)},
  ${sqlValue(video.description)},
  ${sqlValue(video.tagsJson)},
  ${sqlValue(video.engagementRate)},
  ${sqlValue(video.performanceTier)},
  ${sqlValue(video.thumbnailPath)},
  ${sqlValue(video.transcriptPath)},
  ${sqlValue(video.sourcePath)}
);`
    );

    lines.push(
      `INSERT INTO hooks (video_id, text, start_time, end_time, word_count, hook_type) VALUES (
  (SELECT id FROM videos WHERE youtube_id = ${sqlValue(video.youtubeId)}),
  ${sqlValue(video.hookText)},
  0,
  60,
  ${sqlValue(video.hookWordCount)},
  ${sqlValue(video.hookType)}
);`
    );

    if (video.thumbnailAnalysis) {
      lines.push(
        `INSERT INTO thumbnail_analyses (
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
  ${sqlValue(`${channelSlug}:${video.youtubeId}`)},
  (SELECT id FROM videos WHERE youtube_id = ${sqlValue(video.youtubeId)}),
  ${sqlValue(video.thumbnailAnalysis.provider)},
  ${sqlValue(video.thumbnailAnalysis.modelKey)},
  ${sqlValue(video.thumbnailAnalysis.textOverlay)},
  ${sqlValue(video.thumbnailAnalysis.textOverlayPresent ? 1 : 0)},
  ${sqlValue(video.thumbnailAnalysis.textPosition)},
  ${sqlValue(video.thumbnailAnalysis.textSize)},
  ${sqlValue(video.thumbnailAnalysis.hasFace ? 1 : 0)},
  ${sqlValue(video.thumbnailAnalysis.faceCount)},
  ${sqlValue(video.thumbnailAnalysis.expression)},
  ${sqlValue(JSON.stringify(video.thumbnailAnalysis.dominantColors))},
  ${sqlValue(video.thumbnailAnalysis.compositionStyle)},
  ${sqlValue(video.thumbnailAnalysis.primarySubject)},
  ${sqlValue(JSON.stringify(video.thumbnailAnalysis.objects))},
  ${sqlValue(video.thumbnailAnalysis.visualHook)},
  ${sqlValue(video.thumbnailAnalysis.whyItWorks)},
  ${sqlValue(video.thumbnailAnalysis.clarityScore)},
  ${sqlValue(JSON.stringify(video.thumbnailAnalysis))},
  ${sqlValue(scanDate)},
  ${sqlValue(scanDate)}
);`
      );
    }

    for (const chunk of video.chunks) {
      lines.push(
        `INSERT INTO transcript_chunks (video_id, chunk_index, vector_id, text, start_time, end_time, token_count) VALUES (
  (SELECT id FROM videos WHERE youtube_id = ${sqlValue(video.youtubeId)}),
  ${sqlValue(chunk.chunkIndex)},
  ${sqlValue(chunk.vectorId)},
  ${sqlValue(chunk.text)},
  ${sqlValue(chunk.startTime)},
  ${sqlValue(chunk.endTime)},
  ${sqlValue(chunk.tokenCount)}
);`
      );
    }

    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "channel-slug": { type: "string", default: DEFAULT_CHANNEL_SLUG },
      "source-root": { type: "string" },
      "output-root": { type: "string" },
    },
  });

  const channelSlug = values["channel-slug"] || DEFAULT_CHANNEL_SLUG;
  const sourceRoot = values["source-root"]
    ? path.resolve(process.cwd(), values["source-root"])
    : DEFAULT_SOURCE_ROOT;
  const outputRoot = values["output-root"]
    ? path.resolve(process.cwd(), values["output-root"])
    : DEFAULT_OUTPUT_ROOT;

  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Raw channel directory not found at ${sourceRoot}`);
  }

  ensureDir(outputRoot);

  const directories = fs
    .readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(sourceRoot, entry.name));

  const channelMetaDir = directories.find((directory) => path.basename(directory).startsWith("NA - "));
  const standaloneChannelMetaPath = path.join(sourceRoot, "channel.info.json");
  const channelMeta = (() => {
    if (channelMetaDir) {
      const channelMetaFile = fs
        .readdirSync(channelMetaDir)
        .find((entry) => entry.endsWith(".info.json"));
      if (!channelMetaFile) {
        throw new Error(`Could not find channel metadata JSON in ${channelMetaDir}`);
      }
      return JSON.parse(
        fs.readFileSync(path.join(channelMetaDir, channelMetaFile), "utf-8")
      ) as Record<string, unknown>;
    }

    if (fs.existsSync(standaloneChannelMetaPath)) {
      return JSON.parse(fs.readFileSync(standaloneChannelMetaPath, "utf-8")) as Record<string, unknown>;
    }

    return null;
  })();

  const videoDirs = directories.filter((directory) => directory !== channelMetaDir).sort();
  const infoRecords = videoDirs.map((directory) => {
    const files = fs.readdirSync(directory);
    const infoFile = files.find((entry) => entry.endsWith(".info.json"));
    const srtFile = pickPreferredFile(files, [
      (entry) => entry.endsWith(".en.srt"),
      (entry) => entry.endsWith(".en-orig.srt"),
      (entry) => entry.endsWith(".en-en.srt"),
      (entry) => entry.includes(".en-") && entry.endsWith(".srt"),
      (entry) => entry.endsWith(".srt"),
    ]);
    const thumbnailFile = pickPreferredFile(files, [
      (entry) => entry.endsWith(".webp"),
      (entry) => entry.endsWith(".jpg"),
      (entry) => entry.endsWith(".jpeg"),
      (entry) => entry.endsWith(".png"),
    ]);

    if (!infoFile || !srtFile || !thumbnailFile) {
      throw new Error(`Missing required files in ${directory}`);
    }

    const info = JSON.parse(fs.readFileSync(path.join(directory, infoFile), "utf-8")) as InfoJson;
    return {
      directory,
      info,
      srtPath: path.join(directory, srtFile),
      thumbnailPath: path.join(directory, thumbnailFile),
    };
  });

  const performanceTiers = computePerformanceTiers(
    infoRecords.map(({ info }) => ({
      youtubeId: info.id,
      viewCount: info.view_count ?? 0,
    }))
  );

  const fallbackInfo = infoRecords[0]?.info;
  if (!fallbackInfo) {
    throw new Error(`No video records found in ${sourceRoot}`);
  }

  const channelName = String(
    channelMeta?.channel ?? channelMeta?.title ?? fallbackInfo.channel ?? "Unknown channel"
  );
  const channelUrl = String(
    channelMeta?.webpage_url ?? channelMeta?.channel_url ?? fallbackInfo.channel_url ?? ""
  );
  const channelYoutubeId = channelMeta?.channel_id
    ? String(channelMeta.channel_id)
    : fallbackInfo.channel_id ?? null;
  const subscriberCount =
    typeof channelMeta?.channel_follower_count === "number"
      ? Number(channelMeta.channel_follower_count)
      : typeof fallbackInfo.channel_follower_count === "number"
        ? Number(fallbackInfo.channel_follower_count)
        : null;
  const scanDate = new Date().toISOString();

  const seedSqlPath = path.join(outputRoot, `${channelSlug}.seed.sql`);
  const transcriptNdjsonPath = path.join(outputRoot, `${channelSlug}.transcript-chunks.ndjson`);
  const summaryPath = path.join(outputRoot, `${channelSlug}.summary.json`);
  const thumbnailAnalysisPath = path.join(outputRoot, `${channelSlug}.thumbnail-analysis.json`);

  const thumbnailAnalysisCache = loadThumbnailAnalysisCache(thumbnailAnalysisPath);
  const videos: VideoArtifact[] = [];

  for (let index = 0; index < infoRecords.length; index += 1) {
    const { directory, info, srtPath, thumbnailPath } = infoRecords[index];
    const entries = parseSrt(fs.readFileSync(srtPath, "utf-8"));
    const segments = dedupeRollingCaptions(entries);
    const hookSegments = segments.filter((segment) => segment.startTime < 60);
    const uploadDate = normalizeUploadDate(info.upload_date);
    const hookText = sanitizeTranscriptText(hookSegments.map((segment) => segment.text).join(" "));
    const hookWordCount = splitWords(hookText).length;
    const performanceTier = performanceTiers.get(info.id) ?? "average";
    const chunks = buildChunks(
      info.id,
      info.title,
      uploadDate,
      info.view_count ?? 0,
      performanceTier,
      segments
    );

    const relativeThumbnailPath = toPosixRelative(thumbnailPath);
    let thumbnailAnalysis =
      thumbnailAnalysisCache.get(info.id)?.sourceThumbnailPath === relativeThumbnailPath
        ? thumbnailAnalysisCache.get(info.id)?.analysis ?? null
        : null;

    if (!thumbnailAnalysis && process.env.GEMINI_API_KEY?.trim()) {
      console.log(
        `${THUMBNAIL_ANALYSIS_PROGRESS_PREFIX} ${JSON.stringify({
          processed: index,
          stage: "starting",
          title: info.title,
          total: infoRecords.length,
          youtubeId: info.id,
        })}`
      );

      thumbnailAnalysis = await analyzeThumbnail({
        channelName: String(
          channelMeta?.channel ?? channelMeta?.title ?? info.channel ?? "Unknown channel"
        ),
        thumbnailPath,
        title: info.title,
      });

      thumbnailAnalysisCache.set(info.id, {
        analysis: thumbnailAnalysis,
        analyzedAt: new Date().toISOString(),
        sourceThumbnailPath: relativeThumbnailPath,
        youtubeId: info.id,
      });
      persistThumbnailAnalysisCache(thumbnailAnalysisPath, thumbnailAnalysisCache);
    }

    if (process.env.GEMINI_API_KEY?.trim()) {
      console.log(
        `${THUMBNAIL_ANALYSIS_PROGRESS_PREFIX} ${JSON.stringify({
          processed: index + 1,
          stage: "completed",
          title: info.title,
          total: infoRecords.length,
          youtubeId: info.id,
        })}`
      );
    }

    videos.push({
      youtubeId: info.id,
      title: info.title,
      uploadDate,
      durationSec: info.duration ?? 0,
      viewCount: info.view_count ?? 0,
      likeCount: info.like_count ?? 0,
      commentCount: info.comment_count ?? 0,
      description: info.description ?? "",
      tagsJson: JSON.stringify(info.tags ?? []),
      engagementRate:
        info.view_count && info.view_count > 0
          ? Number((((info.like_count ?? 0) + (info.comment_count ?? 0)) / info.view_count).toFixed(6))
          : 0,
      performanceTier,
      thumbnailPath: relativeThumbnailPath,
      transcriptPath: toPosixRelative(srtPath),
      sourcePath: toPosixRelative(directory),
      hookText,
      hookWordCount,
      hookType: detectHookType(hookText),
      thumbnailAnalysis,
      chunks,
    });
  }

  const allChunks = videos.flatMap((video) => video.chunks);
  fs.writeFileSync(
    seedSqlPath,
    buildSql(channelSlug, channelName, channelUrl, channelYoutubeId, subscriberCount, scanDate, videos)
  );
  fs.writeFileSync(
    transcriptNdjsonPath,
    `${allChunks
      .map((chunk) =>
        JSON.stringify({
          id: chunk.vectorId,
          text: chunk.text,
          metadata: {
            channel_slug: channelSlug,
            youtube_id: chunk.youtubeId,
            title: chunk.title,
            upload_date: chunk.uploadDate,
            view_count: chunk.viewCount,
            performance_tier: chunk.performanceTier,
            start_time: chunk.startTime,
            end_time: chunk.endTime,
          },
        })
      )
      .join("\n")}\n`
  );
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        channel: {
          slug: channelSlug,
          name: channelName,
          url: channelUrl,
          youtubeId: channelYoutubeId,
          subscriberCount,
        },
        totals: {
          videos: videos.length,
          chunks: allChunks.length,
          analyzedThumbnails: videos.filter((video) => video.thumbnailAnalysis).length,
          totalViews: videos.reduce((sum, video) => sum + video.viewCount, 0),
        },
      },
      null,
      2
    )
  );

  console.log(`Built artifacts for ${channelSlug}`);
  console.log(`  seed SQL: ${seedSqlPath}`);
  console.log(`  transcript NDJSON: ${transcriptNdjsonPath}`);
  console.log(`  summary JSON: ${summaryPath}`);
  if (process.env.GEMINI_API_KEY?.trim()) {
    console.log(`  thumbnail analysis JSON: ${thumbnailAnalysisPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
