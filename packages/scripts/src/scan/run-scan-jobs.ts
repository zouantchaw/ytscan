import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { THUMBNAIL_ANALYSIS_PROGRESS_PREFIX } from "../lib/thumbnail-analysis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../../");
const WRANGLER_CONFIG = path.resolve(MONOREPO_ROOT, "apps/api/wrangler.toml");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const wranglerCommand =
  process.platform === "win32"
    ? path.resolve(MONOREPO_ROOT, "node_modules/.bin/wrangler.cmd")
    : path.resolve(MONOREPO_ROOT, "node_modules/.bin/wrangler");

dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env") });

const D1_DATABASE = process.env.CLOUDFLARE_D1_DATABASE || "ytscan";
const API_BASE_URL = (process.env.YTSCAN_API_URL || process.env.BETTER_AUTH_URL || "https://ytscan-api.wiel.workers.dev").replace(
  /\/+$/,
  ""
);
const INTERNAL_RUNNER_TOKEN = process.env.INTERNAL_RUNNER_TOKEN || "";
const POLL_INTERVAL_MS = Number(process.env.SCAN_POLL_INTERVAL_SECONDS || "30") * 1000;
const DOWNLOAD_PROGRESS_POLL_MS =
  Number(process.env.SCAN_DOWNLOAD_PROGRESS_SECONDS || "15") * 1000;
const YT_DLP_REMOTE_COMPONENTS = "ejs:github";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type ScanJobRow = {
  id: string;
  channel_url: string;
  requested_channel_slug: string | null;
  status: string;
  stage: string;
  progress: number;
  total_videos: number | null;
  processed_videos: number | null;
  message: string | null;
  created_at: string;
  updated_at: string;
};

type LeasedScanJob = ScanJobRow & {
  leaseToken: string;
};

type ScanSummary = {
  channel?: {
    slug?: string;
    name?: string;
    url?: string;
    youtubeId?: string | null;
    subscriberCount?: number | null;
  };
  totals?: {
    videos?: number;
    chunks?: number;
    totalViews?: number;
  };
};

type ChannelMetadata = Record<string, unknown> & {
  channel?: string;
  playlist_count?: number;
  entries?: unknown[];
};

type JobPatch = {
  status?: string;
  stage?: string;
  progress?: number;
  totalVideos?: number | null;
  processedVideos?: number | null;
  message?: string | null;
  requestedChannelSlug?: string | null;
};

function sqlValue(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, 400);
}

function getJsRuntimeSpec(): string {
  return process.execPath ? `node:${process.execPath}` : "node";
}

async function runCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    captureStdout?: boolean;
    captureStderr?: boolean;
    onStderrChunk?: (chunk: string) => void;
    onStdoutChunk?: (chunk: string) => void;
    pipeStdout?: boolean;
    pipeStderr?: boolean;
  }
): Promise<CommandResult> {
  const cwd = options?.cwd ?? MONOREPO_ROOT;
  const captureStdout = options?.captureStdout ?? true;
  const captureStderr = options?.captureStderr ?? true;
  const pipeStdout = options?.pipeStdout ?? true;
  const pipeStderr = options?.pipeStderr ?? true;

  return await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (pipeStdout) process.stdout.write(text);
      if (captureStdout) stdoutChunks.push(text);
      options?.onStdoutChunk?.(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (pipeStderr) process.stderr.write(text);
      if (captureStderr) stderrChunks.push(text);
      options?.onStderrChunk?.(text);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = stderrChunks.join("").trim();
        reject(new Error(stderr || `${command} exited with code ${code}`));
        return;
      }

      resolve({
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });
  });
}

async function runWranglerJson(args: string[]): Promise<any> {
  const result = await runCommand(wranglerCommand, args, {
    captureStdout: true,
    captureStderr: true,
    pipeStdout: false,
  });
  return JSON.parse(result.stdout);
}

async function apiRequest<T>(pathname: string, init?: RequestInit): Promise<T> {
  if (!INTERNAL_RUNNER_TOKEN) {
    throw new Error("INTERNAL_RUNNER_TOKEN is required for runner control-plane requests.");
  }

  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  headers.set("x-internal-token", INTERNAL_RUNNER_TOKEN);

  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Control plane request failed (${response.status} ${response.statusText}): ${body}`);
  }

  return (await response.json()) as T;
}

function toRunnerJob(payload: any): LeasedScanJob {
  return {
    channel_url: String(payload.channelUrl ?? ""),
    created_at: String(payload.createdAt ?? ""),
    id: String(payload.jobId),
    leaseToken: String(payload.leaseToken ?? ""),
    message: payload.message ? String(payload.message) : null,
    processed_videos:
      payload.processedVideos === null || payload.processedVideos === undefined
        ? null
        : Number(payload.processedVideos),
    progress: Number(payload.progress ?? 0),
    requested_channel_slug: payload.requestedChannelSlug
      ? String(payload.requestedChannelSlug)
      : null,
    stage: String(payload.stage ?? "queued"),
    status: String(payload.status ?? "queued"),
    total_videos:
      payload.totalVideos === null || payload.totalVideos === undefined
        ? null
        : Number(payload.totalVideos),
    updated_at: String(payload.updatedAt ?? ""),
  };
}

async function leaseJob(jobId?: string): Promise<LeasedScanJob | null> {
  const payload = await apiRequest<{ job: Record<string, unknown> | null }>(
    "/api/internal/scan-jobs",
    {
      body: JSON.stringify(jobId ? { jobId } : {}),
      method: "POST",
    }
  );

  return payload.job ? toRunnerJob(payload.job) : null;
}

async function patchJob(job: LeasedScanJob, patch: JobPatch): Promise<void> {
  await apiRequest(`/api/internal/scan-jobs/${job.id}/progress`, {
    body: JSON.stringify({
      leaseToken: job.leaseToken,
      ...patch,
    }),
    method: "POST",
  });
}

async function completeJob(job: LeasedScanJob, patch: JobPatch): Promise<void> {
  await apiRequest(`/api/internal/scan-jobs/${job.id}/complete`, {
    body: JSON.stringify({
      leaseToken: job.leaseToken,
      ...patch,
    }),
    method: "POST",
  });
}

async function failJob(job: LeasedScanJob, patch: JobPatch): Promise<void> {
  await apiRequest(`/api/internal/scan-jobs/${job.id}/fail`, {
    body: JSON.stringify({
      leaseToken: job.leaseToken,
      ...patch,
    }),
    method: "POST",
  });
}

async function d1ExecuteSql(sql: string): Promise<any> {
  const payload = await runWranglerJson([
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

  return payload[0];
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

async function getJobById(jobId: string): Promise<ScanJobRow | null> {
  const result = await d1ExecuteSql(`
    SELECT
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
    FROM scan_jobs
    WHERE id = ${sqlValue(jobId)}
    LIMIT 1;
  `);

  return (result.results?.[0] as ScanJobRow | undefined) ?? null;
}

async function getWorkspaceIdForJob(jobId: string): Promise<string | null> {
  const result = await d1ExecuteSql(`
    SELECT workspace_id
    FROM scan_jobs
    WHERE id = ${sqlValue(jobId)}
    LIMIT 1;
  `);

  const row = result.results?.[0] as { workspace_id?: string | null } | undefined;
  return row?.workspace_id ? String(row.workspace_id) : null;
}

async function createQueuedJob(channelUrl: string, requestedChannelSlug: string | null): Promise<ScanJobRow> {
  const jobId = globalThis.crypto.randomUUID();
  const now = new Date().toISOString();

  await d1ExecuteSql(`
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
      created_at,
      updated_at
    ) VALUES (
      ${sqlValue(jobId)},
      ${sqlValue(channelUrl)},
      ${sqlValue(requestedChannelSlug)},
      'queued',
      'queued',
      0,
      NULL,
      NULL,
      ${sqlValue("Queued for offline ingest orchestration")},
      ${sqlValue(now)},
      ${sqlValue(now)}
    );
  `);

  const created = await getJobById(jobId);
  if (!created) {
    throw new Error(`Failed to load queued scan job ${jobId}`);
  }

  return created;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function deriveRequestedChannelSlug(channelUrl: string): string | null {
  try {
    const parsed = new URL(channelUrl);
    const segments = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const handleSegment = segments.find((segment) => segment.startsWith("@"));
    if (handleSegment) return slugify(handleSegment.slice(1));

    const finalSegment = segments[segments.length - 1] ?? "";
    return finalSegment ? slugify(finalSegment) : null;
  } catch {
    return null;
  }
}

function buildVideosUrl(channelUrl: string): string {
  const parsed = new URL(channelUrl);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = pathname.endsWith("/videos") ? pathname : `${pathname}/videos`;
  parsed.search = "";
  return parsed.toString();
}

function getChannelPaths(channelSlug: string) {
  const root = path.resolve(MONOREPO_ROOT, `data/channels/${channelSlug}`);
  return {
    root,
    rawRoot: path.join(root, "raw"),
    outputRoot: path.join(root, "exports"),
    checkpointPath: path.join(root, ".checkpoints/vectorize-upsert.json"),
    failureLogPath: path.join(root, ".logs/vectorize-upsert-failures.ndjson"),
    transcriptPath: path.join(root, "exports", `${channelSlug}.transcript-chunks.ndjson`),
    seedSqlPath: path.join(root, "exports", `${channelSlug}.seed.sql`),
    summaryPath: path.join(root, "exports", `${channelSlug}.summary.json`),
    channelMetaPath: path.join(root, "raw", "channel.info.json"),
  };
}

function countInfoJsonFiles(rootPath: string): number {
  if (!fs.existsSync(rootPath)) return 0;

  let count = 0;
  const queue = [rootPath];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".info.json") && entry.name !== "channel.info.json") {
        try {
          const raw = fs.readFileSync(fullPath, "utf-8");
          const parsed = JSON.parse(raw) as { _type?: string };
          if (parsed._type === "playlist") continue;
        } catch {
          // Keep counting files we fail to parse so a malformed video record still surfaces.
        }

        count += 1;
      }
    }
  }

  return count;
}

function deriveExpectedVideoCount(metadata: ChannelMetadata): number | null {
  if (Array.isArray(metadata.entries) && metadata.entries.length > 0) {
    return metadata.entries.length;
  }

  return typeof metadata.playlist_count === "number" && metadata.playlist_count > 0
    ? metadata.playlist_count
    : null;
}

function loadSummary(summaryPath: string): ScanSummary {
  return JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as ScanSummary;
}

function countNdjsonRecords(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;

  return fs
    .readFileSync(filePath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function loadVectorizeCheckpointProgress(checkpointPath: string, inputPath: string): number {
  if (!fs.existsSync(checkpointPath)) return 0;

  try {
    const raw = JSON.parse(fs.readFileSync(checkpointPath, "utf-8")) as {
      nextIndex?: number;
      inputPath?: string;
    };
    if (raw.inputPath !== inputPath || typeof raw.nextIndex !== "number") return 0;
    return raw.nextIndex;
  } catch {
    return 0;
  }
}

async function writeChannelMetadata(channelUrl: string, channelMetaPath: string): Promise<ChannelMetadata> {
  ensureDir(path.dirname(channelMetaPath));
  const metadataUrl = buildVideosUrl(channelUrl);
  const result = await runCommand(
    "yt-dlp",
    [
      "--js-runtimes",
      getJsRuntimeSpec(),
      "--remote-components",
      YT_DLP_REMOTE_COMPONENTS,
      "--flat-playlist",
      "--dump-single-json",
      metadataUrl,
    ],
    {
      captureStdout: true,
      captureStderr: true,
      pipeStdout: false,
    }
  );

  const trimmed = result.stdout.trim();
  fs.writeFileSync(channelMetaPath, `${trimmed}\n`);
  return JSON.parse(trimmed) as ChannelMetadata;
}

async function downloadChannel(
  channelUrl: string,
  rawRoot: string,
  options?: {
    job: LeasedScanJob;
    channelName: string;
    totalVideos: number | null;
  }
): Promise<void> {
  ensureDir(rawRoot);

  const outputTemplate = path.join(
    rawRoot,
    "%(upload_date>%Y%m%d)s - %(title).200B [%(id)s]/%(upload_date>%Y%m%d)s - %(title).200B [%(id)s].%(ext)s"
  );

  let lastProcessed = -1;
  const reportDownloadProgress = async (force: boolean): Promise<void> => {
    if (!options) return;

    const processedVideos = countInfoJsonFiles(rawRoot);
    if (!force && processedVideos === lastProcessed) return;
    lastProcessed = processedVideos;

    const ratio =
      options.totalVideos && options.totalVideos > 0
        ? Math.min(processedVideos / options.totalVideos, 1)
        : 0;
    const progress = Number((0.1 + ratio * 0.22).toFixed(3));
    const progressLabel = options.totalVideos
      ? `${processedVideos}/${options.totalVideos}`
      : `${processedVideos}`;

    await patchJob(options.job, {
      stage: "downloading",
      progress,
      totalVideos: options.totalVideos,
      processedVideos,
      message: `Downloading channel corpus for ${options.channelName} (${progressLabel})`,
    });
  };

  const progressInterval = options
    ? setInterval(() => {
        void reportDownloadProgress(false);
      }, DOWNLOAD_PROGRESS_POLL_MS)
    : null;

  let downloadError: unknown = null;
  try {
    await runCommand(
      "yt-dlp",
      [
        "--js-runtimes",
        getJsRuntimeSpec(),
        "--remote-components",
        YT_DLP_REMOTE_COMPONENTS,
        "--ignore-errors",
        "--yes-playlist",
        "--sleep-requests",
        "1",
        "--skip-download",
        "--write-info-json",
        "--write-auto-subs",
        "--sub-langs",
        "en,en-orig",
        "--convert-subs",
        "srt",
        "--write-thumbnail",
        "--convert-thumbnails",
        "webp",
        "--output",
        outputTemplate,
        buildVideosUrl(channelUrl),
      ],
      {
        captureStdout: false,
        captureStderr: true,
      }
    );
  } catch (error) {
    downloadError = error;
  } finally {
    if (progressInterval) clearInterval(progressInterval);
  }

  await reportDownloadProgress(true);

  if (downloadError) {
    const processedVideos = countInfoJsonFiles(rawRoot);
    if (options?.totalVideos && processedVideos >= options.totalVideos) {
      console.warn(
        `yt-dlp exited non-zero after reaching expected corpus size (${processedVideos}/${options.totalVideos}); continuing.`
      );
      return;
    }

    throw downloadError;
  }
}

async function buildArtifacts(
  channelSlug: string,
  rawRoot: string,
  outputRoot: string,
  options?: { job?: LeasedScanJob; totalVideos?: number | null }
): Promise<void> {
  let stdoutBuffer = "";

  await runCommand(npmCommand, [
    "--prefix",
    MONOREPO_ROOT,
    "run",
    "build:artifacts",
    "--workspace=@ytscan/scripts",
    "--",
    "--channel-slug",
    channelSlug,
    "--source-root",
    rawRoot,
    "--output-root",
    outputRoot,
  ], {
    onStdoutChunk(chunk) {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(THUMBNAIL_ANALYSIS_PROGRESS_PREFIX)) continue;

        const rawJson = trimmed.slice(THUMBNAIL_ANALYSIS_PROGRESS_PREFIX.length).trim();
        try {
          const payload = JSON.parse(rawJson) as {
            processed?: number;
            title?: string;
            total?: number;
          };
          if (options?.job && payload.total && Number.isFinite(payload.processed)) {
            void patchJob(options.job, {
              stage: "analyzing_thumbnails",
              progress: Number((0.62 + (Number(payload.processed) / payload.total) * 0.15).toFixed(3)),
              totalVideos: payload.total,
              processedVideos: payload.processed,
              message: `Analyzing thumbnails (${payload.processed}/${payload.total})${payload.title ? ` · ${payload.title}` : ""}`,
            });
          }
        } catch (error) {
          console.warn("Failed to parse thumbnail analysis progress line", error);
        }
      }
    },
  });
}

async function assignChannelToWorkspace(channelSlug: string, workspaceId: string): Promise<void> {
  await d1ExecuteSql(`
    UPDATE channels
    SET workspace_id = ${sqlValue(workspaceId)}
    WHERE slug = ${sqlValue(channelSlug)};
  `);
}

async function upsertVectors(
  transcriptPath: string,
  checkpointPath: string,
  failureLogPath: string,
  options?: {
    job: LeasedScanJob;
    channelSlug: string;
    totalChunks: number;
  }
): Promise<void> {
  let lastUpserted = -1;
  const reportVectorizeProgress = async (force: boolean): Promise<void> => {
    if (!options) return;

    const upsertedChunks = Math.min(
      loadVectorizeCheckpointProgress(checkpointPath, transcriptPath),
      options.totalChunks
    );
    if (!force && upsertedChunks === lastUpserted) return;
    lastUpserted = upsertedChunks;

    const ratio = options.totalChunks > 0 ? Math.min(upsertedChunks / options.totalChunks, 1) : 0;
    const progress = Number((0.82 + ratio * 0.17).toFixed(3));

    await patchJob(options.job, {
      stage: "vectorizing",
      progress,
      message: `Upserting transcript embeddings for ${options.channelSlug} (${upsertedChunks}/${options.totalChunks} chunks)`,
    });
  };

  const progressInterval = options
    ? setInterval(() => {
        void reportVectorizeProgress(false);
      }, DOWNLOAD_PROGRESS_POLL_MS)
    : null;

  try {
    await runCommand(npmCommand, [
      "--prefix",
      MONOREPO_ROOT,
      "run",
      "vectorize:upsert",
      "--workspace=@ytscan/scripts",
      "--",
      "--input",
      transcriptPath,
      "--checkpoint",
      checkpointPath,
      "--failure-log",
      failureLogPath,
      "--reset",
    ]);
  } finally {
    if (progressInterval) clearInterval(progressInterval);
  }

  await reportVectorizeProgress(true);
}

async function seedD1(seedSqlPath: string): Promise<void> {
  await d1ExecuteFile(seedSqlPath);
}

async function processJob(job: LeasedScanJob): Promise<void> {
  const requestedSlug = job.requested_channel_slug || deriveRequestedChannelSlug(job.channel_url);
  if (!requestedSlug) {
    throw new Error(`Could not derive channel slug from ${job.channel_url}`);
  }

  const paths = getChannelPaths(requestedSlug);
  ensureDir(paths.rawRoot);
  ensureDir(paths.outputRoot);

  await patchJob(job, {
    status: "running",
    stage: "downloading",
    progress: 0.05,
    message: "Fetching channel metadata and yt-dlp assets",
    requestedChannelSlug: requestedSlug,
  });

  const metadata = await writeChannelMetadata(job.channel_url, paths.channelMetaPath);
  const metadataSlug =
    typeof metadata.channel === "string" && metadata.channel.trim() !== ""
      ? slugify(metadata.channel)
      : requestedSlug;
  const expectedVideos = deriveExpectedVideoCount(metadata);
  const existingVideos = countInfoJsonFiles(paths.rawRoot);

  await patchJob(job, {
    requestedChannelSlug: requestedSlug,
    stage: "downloading",
    progress: 0.1,
    totalVideos: expectedVideos,
    processedVideos: existingVideos,
    message: `Downloading channel corpus for ${String(metadata.channel ?? requestedSlug)}`,
  });

  if (expectedVideos && existingVideos >= expectedVideos) {
    await patchJob(job, {
      stage: "downloading",
      progress: 0.32,
      totalVideos: expectedVideos,
      processedVideos: existingVideos,
      message: `Reusing existing channel corpus for ${String(metadata.channel ?? requestedSlug)} (${existingVideos}/${expectedVideos})`,
    });
  } else {
    await downloadChannel(job.channel_url, paths.rawRoot, {
      job,
      channelName: String(metadata.channel ?? requestedSlug),
      totalVideos: expectedVideos,
    });
  }

  const totalVideos = countInfoJsonFiles(paths.rawRoot);
  await patchJob(job, {
    stage: "building_artifacts",
    progress: 0.4,
    totalVideos: expectedVideos ?? totalVideos,
    processedVideos: totalVideos,
    message: `Downloaded ${totalVideos} videos, building structured artifacts`,
  });

  await buildArtifacts(requestedSlug, paths.rawRoot, paths.outputRoot, {
    job,
    totalVideos: expectedVideos ?? totalVideos,
  });

  const summary = loadSummary(paths.summaryPath);
  const finalChannelSlug = String(summary.channel?.slug ?? requestedSlug);
  const summaryVideos = summary.totals?.videos ?? totalVideos;
  const summaryChunks = summary.totals?.chunks ?? countNdjsonRecords(paths.transcriptPath);

  await patchJob(job, {
    stage: "seeding_d1",
    progress: 0.65,
    totalVideos: summaryVideos,
    processedVideos: summaryVideos,
    message: `Seeding D1 for ${summary.channel?.name ?? metadataSlug}`,
  });

  await seedD1(paths.seedSqlPath);

  const workspaceId = await getWorkspaceIdForJob(job.id);
  if (workspaceId) {
    await assignChannelToWorkspace(finalChannelSlug, workspaceId);
  }

  await patchJob(job, {
    stage: "vectorizing",
    progress: 0.82,
    message: `Upserting transcript embeddings for ${requestedSlug} (0/${summaryChunks} chunks)`,
  });

  await upsertVectors(paths.transcriptPath, paths.checkpointPath, paths.failureLogPath, {
    job,
    channelSlug: requestedSlug,
    totalChunks: summaryChunks,
  });

  await completeJob(job, {
    totalVideos: summaryVideos,
    processedVideos: summaryVideos,
    message: `Completed ingest for ${summary.channel?.name ?? finalChannelSlug}`,
    requestedChannelSlug: finalChannelSlug,
  });
}

async function resolveTargetJob(
  requestedJobId: string | undefined,
  channelUrl: string | undefined,
  requestedSlug: string | undefined
) : Promise<LeasedScanJob | null> {
  if (requestedJobId) {
    return await leaseJob(requestedJobId);
  }

  if (channelUrl) {
    const created = await createQueuedJob(channelUrl, requestedSlug ?? deriveRequestedChannelSlug(channelUrl));
    return await leaseJob(created.id);
  }

  return await leaseJob();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "job-id": { type: "string" },
      "channel-url": { type: "string" },
      "channel-slug": { type: "string" },
      once: { type: "boolean", default: false },
      "poll-interval-seconds": { type: "string" },
    },
  });

  const pollInterval =
    values["poll-interval-seconds"] && Number.isFinite(Number(values["poll-interval-seconds"]))
      ? Number(values["poll-interval-seconds"]) * 1000
      : POLL_INTERVAL_MS;

  do {
    const job = await resolveTargetJob(
      values["job-id"],
      values["channel-url"],
      values["channel-slug"]
    );

    if (!job) {
      if (values.once || values["job-id"] || values["channel-url"]) {
        console.log("No matching scan job found.");
        return;
      }

      console.log(`No queued scan jobs. Sleeping for ${pollInterval / 1000}s.`);
      await sleep(pollInterval);
      continue;
    }

    try {
      await processJob(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(job, {
        status: "failed",
        stage: "failed",
        message,
      });
      throw error;
    }

    if (values.once || values["job-id"] || values["channel-url"]) {
      return;
    }
  } while (true);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
