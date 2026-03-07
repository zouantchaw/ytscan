import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../../");
const DEFAULT_CHANNEL_SLUG = "codie-sanchez";
const DEFAULT_SOURCE_ROOT = path.resolve(MONOREPO_ROOT, "data/channels/codie-sanchez/raw");
const DEFAULT_OUTPUT_ROOT = path.resolve(MONOREPO_ROOT, "data/channels/codie-sanchez/exports");
const WORDS_PER_CHUNK = 320;

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
    const normalizedText = normalizeWhitespace(payload);
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
    const text = currentWords.join(" ").trim();
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

function buildSql(channelSlug: string, channelName: string, channelUrl: string, channelYoutubeId: string | null, subscriberCount: number | null, scanDate: string, videos: VideoArtifact[]): string {
  const lines: string[] = [];
  lines.push("PRAGMA foreign_keys = ON;");
  lines.push("");
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
  if (!channelMetaDir) {
    throw new Error(`Could not find channel metadata directory in ${sourceRoot}`);
  }

  const channelMetaFile = fs
    .readdirSync(channelMetaDir)
    .find((entry) => entry.endsWith(".info.json"));
  if (!channelMetaFile) {
    throw new Error(`Could not find channel metadata JSON in ${channelMetaDir}`);
  }

  const channelMeta = JSON.parse(
    fs.readFileSync(path.join(channelMetaDir, channelMetaFile), "utf-8")
  ) as Record<string, unknown>;

  const videoDirs = directories.filter((directory) => directory !== channelMetaDir).sort();
  const infoRecords = videoDirs.map((directory) => {
    const files = fs.readdirSync(directory);
    const infoFile = files.find((entry) => entry.endsWith(".info.json"));
    const srtFile = files.find((entry) => entry.endsWith(".en.srt"));
    const webpFile = files.find((entry) => entry.endsWith(".webp"));

    if (!infoFile || !srtFile || !webpFile) {
      throw new Error(`Missing required files in ${directory}`);
    }

    const info = JSON.parse(fs.readFileSync(path.join(directory, infoFile), "utf-8")) as InfoJson;
    return {
      directory,
      info,
      srtPath: path.join(directory, srtFile),
      thumbnailPath: path.join(directory, webpFile),
    };
  });

  const performanceTiers = computePerformanceTiers(
    infoRecords.map(({ info }) => ({
      youtubeId: info.id,
      viewCount: info.view_count ?? 0,
    }))
  );

  const videos: VideoArtifact[] = infoRecords.map(({ directory, info, srtPath, thumbnailPath }) => {
    const entries = parseSrt(fs.readFileSync(srtPath, "utf-8"));
    const segments = dedupeRollingCaptions(entries);
    const hookSegments = segments.filter((segment) => segment.startTime < 60);
    const hookText = normalizeWhitespace(hookSegments.map((segment) => segment.text).join(" "));
    const hookWordCount = splitWords(hookText).length;
    const performanceTier = performanceTiers.get(info.id) ?? "average";
    const chunks = buildChunks(
      info.id,
      info.title,
      info.upload_date ?? "",
      info.view_count ?? 0,
      performanceTier,
      segments
    );

    return {
      youtubeId: info.id,
      title: info.title,
      uploadDate: info.upload_date ?? "",
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
      thumbnailPath: toPosixRelative(thumbnailPath),
      transcriptPath: toPosixRelative(srtPath),
      sourcePath: toPosixRelative(directory),
      hookText,
      hookWordCount,
      hookType: detectHookType(hookText),
      chunks,
    };
  });

  const channelName = String(channelMeta.channel ?? channelMeta.title ?? "Unknown channel");
  const channelUrl = String(channelMeta.webpage_url ?? channelMeta.channel_url ?? "");
  const channelYoutubeId = channelMeta.channel_id ? String(channelMeta.channel_id) : null;
  const subscriberCount = channelMeta.channel_follower_count ? Number(channelMeta.channel_follower_count) : null;
  const scanDate = new Date().toISOString();

  const seedSqlPath = path.join(outputRoot, `${channelSlug}.seed.sql`);
  const transcriptNdjsonPath = path.join(outputRoot, `${channelSlug}.transcript-chunks.ndjson`);
  const summaryPath = path.join(outputRoot, `${channelSlug}.summary.json`);

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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
