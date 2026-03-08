import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../../");

dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env") });

const API_BASE_URL = (process.env.YTSCAN_API_URL || process.env.BETTER_AUTH_URL || "https://ytscan-api.wiel.workers.dev").replace(
  /\/+$/,
  ""
);
const INTERNAL_RUNNER_TOKEN = process.env.INTERNAL_RUNNER_TOKEN || "";
const POLL_INTERVAL_MS = Number(process.env.MEDIA_POLL_INTERVAL_SECONDS || "15") * 1000;
const HEARTBEAT_INTERVAL_MS = Number(process.env.MEDIA_HEARTBEAT_INTERVAL_SECONDS || "60") * 1000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";
const PREVIS_SCENE_DURATION_SECONDS = Number(process.env.PREVIS_SCENE_DURATION_SECONDS || "5");
const GENERATED_MEDIA_ROOT = path.resolve(MONOREPO_ROOT, "data/generated-media");

type JsonObject = Record<string, unknown>;

type GenerationJob = {
  id: string;
  projectId: string | null;
  personaModelId: string | null;
  jobType: string;
  provider: string;
  providerJobId: string | null;
  status: string;
  stage: string;
  progress: number;
  input: JsonObject;
  output: JsonObject;
  message: string | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LeasedGenerationJob = GenerationJob & {
  leaseToken: string;
};

type GenerationAsset = {
  id: string;
  projectId: string | null;
  generationJobId: string | null;
  assetKind: string;
  variant: string | null;
  mimeType: string;
  fileName: string;
  byteSize: number | null;
  metadata: JsonObject;
  createdAt: string;
  downloadPath: string;
};

type ReferenceImage = {
  thumbnailUrl: string;
  title: string;
  viewCount: number;
  youtubeId: string;
};

type ThumbnailJobInput = {
  briefContent?: string;
  briefId?: string;
  channelName?: string;
  channelSlug?: string;
  projectTitle?: string;
  referenceImages?: ReferenceImage[];
  topic?: string;
};

type PrevisJobInput = ThumbnailJobInput & {
  scriptContent?: string;
  directorNotesContent?: string;
  thumbnailBriefContent?: string;
};

type ScenePlan = {
  caption: string;
  prompt: string;
  title: string;
};

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 400) : null;
}

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "asset";
}

async function runCommand(command: string, args: string[], cwd = MONOREPO_ROOT): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => process.stdout.write(chunk.toString()));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

async function apiJsonRequest<T>(pathname: string, init?: RequestInit): Promise<T> {
  if (!INTERNAL_RUNNER_TOKEN) {
    throw new Error("INTERNAL_RUNNER_TOKEN is required for media worker control-plane requests.");
  }

  const headers = new Headers(init?.headers);
  headers.set("x-internal-token", INTERNAL_RUNNER_TOKEN);
  if (!(init?.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

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

async function leaseJob(jobId?: string): Promise<LeasedGenerationJob | null> {
  const payload = await apiJsonRequest<{ job: (GenerationJob & { leaseToken: string }) | null }>(
    "/api/internal/generation-jobs",
    {
      method: "POST",
      body: JSON.stringify(jobId ? { jobId } : {}),
    }
  );

  return payload.job;
}

async function patchJob(
  job: LeasedGenerationJob,
  patch: {
    message?: string | null;
    output?: JsonObject;
    progress?: number;
    providerJobId?: string | null;
    stage?: string;
    status?: string;
  }
): Promise<void> {
  await apiJsonRequest(`/api/internal/generation-jobs/${job.id}/progress`, {
    method: "POST",
    body: JSON.stringify({
      leaseToken: job.leaseToken,
      ...patch,
    }),
  });
}

async function heartbeatJob(job: LeasedGenerationJob): Promise<void> {
  await apiJsonRequest(`/api/internal/generation-jobs/${job.id}/heartbeat`, {
    method: "POST",
    body: JSON.stringify({ leaseToken: job.leaseToken }),
  });
}

async function completeJob(
  job: LeasedGenerationJob,
  patch: {
    message?: string | null;
    output?: JsonObject;
    providerJobId?: string | null;
    stage?: string;
  }
): Promise<void> {
  await apiJsonRequest(`/api/internal/generation-jobs/${job.id}/complete`, {
    method: "POST",
    body: JSON.stringify({
      leaseToken: job.leaseToken,
      ...patch,
    }),
  });
}

async function failJob(
  job: LeasedGenerationJob,
  patch: {
    message?: string | null;
    output?: JsonObject;
    progress?: number;
    providerJobId?: string | null;
    stage?: string;
  }
): Promise<void> {
  await apiJsonRequest(`/api/internal/generation-jobs/${job.id}/fail`, {
    method: "POST",
    body: JSON.stringify({
      leaseToken: job.leaseToken,
      ...patch,
    }),
  });
}

async function uploadAsset(
  job: LeasedGenerationJob,
  params: {
    assetKind: string;
    fileName: string;
    filePath: string;
    metadata?: JsonObject;
    mimeType: string;
    variant?: string | null;
  }
): Promise<GenerationAsset> {
  const fileBuffer = fs.readFileSync(params.filePath);
  const formData = new FormData();
  formData.set("leaseToken", job.leaseToken);
  formData.set("assetKind", params.assetKind);
  formData.set("fileName", params.fileName);
  formData.set("mimeType", params.mimeType);
  formData.set("projectId", job.projectId ?? "");
  if (params.variant) {
    formData.set("variant", params.variant);
  }
  if (params.metadata) {
    formData.set("metadata", JSON.stringify(params.metadata));
  }
  formData.set("file", new File([fileBuffer], params.fileName, { type: params.mimeType }));

  const headers = new Headers();
  headers.set("x-internal-token", INTERNAL_RUNNER_TOKEN);

  const response = await fetch(`${API_BASE_URL}/api/internal/generation-jobs/${job.id}/assets`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Asset upload failed (${response.status} ${response.statusText}): ${await response.text()}`);
  }

  const payload = (await response.json()) as { asset: GenerationAsset };
  return payload.asset;
}

async function fetchReferenceImageParts(referenceImages: ReferenceImage[], limit = 2) {
  const selected = referenceImages.slice(0, limit);
  const parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];

  for (const image of selected) {
    try {
      const response = await fetch(image.thumbnailUrl);
      if (!response.ok) continue;
      const mimeType = response.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());
      parts.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType,
        },
      });
    } catch (error) {
      console.warn(`Unable to fetch reference image ${image.youtubeId}:`, error);
    }
  }

  return parts;
}

function extractConceptSections(briefContent: string): Array<{ title: string; body: string }> {
  const sections = briefContent
    .split(/\n##\s+/)
    .map((section, index) => (index === 0 ? section.replace(/^#.*\n?/, "").trim() : section.trim()))
    .filter(Boolean)
    .map((section) => {
      const [titleLine, ...bodyLines] = section.split("\n");
      return {
        title: titleLine.replace(/^#+\s*/, "").trim() || "Concept",
        body: bodyLines.join("\n").trim(),
      };
    })
    .filter((section) => section.body);

  return sections.length
    ? sections.slice(0, 3)
    : [
        { title: "Concept 1", body: briefContent.trim() },
        { title: "Concept 2", body: briefContent.trim() },
        { title: "Concept 3", body: briefContent.trim() },
      ];
}

async function generateImageBuffer(prompt: string, referenceImages: ReferenceImage[]): Promise<Buffer> {
  if (!ai) {
    throw new Error("GEMINI_API_KEY is required for media generation.");
  }

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: prompt },
    ...(await fetchReferenceImageParts(referenceImages)),
  ];

  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if ("inlineData" in part && part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
  }

  throw new Error("Gemini image generation returned no image data.");
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^#+\s+/gm, "")
    .replace(/^\-\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildScenePlan(input: PrevisJobInput): ScenePlan[] {
  const scriptSentences = stripMarkdown(input.scriptContent ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const noteLines = stripMarkdown(input.directorNotesContent ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const plans: ScenePlan[] = [];
  const totalScenes = Math.max(4, Math.min(6, scriptSentences.length || 4));

  for (let index = 0; index < totalScenes; index += 1) {
    const caption = scriptSentences[index] ?? `Introduce ${input.topic ?? input.projectTitle ?? "the story"} with one crisp proof point.`;
    const visualNote = noteLines[index] ?? "Editorial, cinematic, clean composition with clear subject separation.";
    plans.push({
      title: `Scene ${index + 1}`,
      caption,
      prompt: [
        `Create a 16:9 storyboard frame for a YouTube business explainer titled "${input.projectTitle ?? input.topic ?? "YTScan"}".`,
        `Topic: ${input.topic ?? input.projectTitle ?? "Unknown topic"}.`,
        `Narration beat: ${caption}`,
        `Visual guidance: ${visualNote}`,
        "Style: cinematic but practical, high contrast, editorial composition, realistic lighting, no watermark, no UI chrome, no text blocks baked into the image.",
      ].join("\n"),
    });
  }

  return plans;
}

async function maybeGenerateSpeech(scriptContent: string, outputDir: string): Promise<string | null> {
  if (!ai || !scriptContent.trim()) {
    return null;
  }

  const previewScript = stripMarkdown(scriptContent)
    .split(/(?<=[.!?])\s+/)
    .slice(0, 8)
    .join(" ")
    .trim();
  if (!previewScript) return null;

  const response = await ai.models.generateContent({
    model: GEMINI_TTS_MODEL,
    contents: [{ role: "user", parts: [{ text: `Read this in a confident documentary narration tone: ${previewScript}` }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: GEMINI_TTS_VOICE,
          },
        },
      },
    },
  });

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if ("inlineData" in part && part.inlineData?.data) {
        const pcmPath = path.join(outputDir, "voiceover.pcm");
        const wavPath = path.join(outputDir, "voiceover.wav");
        fs.writeFileSync(pcmPath, Buffer.from(part.inlineData.data, "base64"));
        await runCommand("ffmpeg", [
          "-y",
          "-f",
          "s16le",
          "-ar",
          "24000",
          "-ac",
          "1",
          "-i",
          pcmPath,
          wavPath,
        ]);
        return wavPath;
      }
    }
  }

  return null;
}

async function createVideoSegment(imagePath: string, outputPath: string): Promise<void> {
  await runCommand("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p",
    "-t",
    String(PREVIS_SCENE_DURATION_SECONDS),
    "-r",
    "24",
    outputPath,
  ]);
}

async function concatVideoSegments(segmentPaths: string[], outputPath: string): Promise<void> {
  const listPath = path.join(path.dirname(outputPath), "segments.txt");
  fs.writeFileSync(
    listPath,
    segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join("\n")
  );

  await runCommand("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
}

async function muxAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ]);
}

async function handleThumbnailImages(job: LeasedGenerationJob): Promise<JsonObject> {
  const input = job.input as ThumbnailJobInput;
  const outputDir = path.join(GENERATED_MEDIA_ROOT, job.id);
  ensureDir(outputDir);

  const sections = extractConceptSections(input.briefContent ?? "");
  const assets: GenerationAsset[] = [];

  await patchJob(job, {
    stage: "storyboarding",
    progress: 0.05,
    message: "Generating thumbnail concepts",
  });

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const variant = `concept-${index + 1}`;
    const prompt = [
      `Generate a polished 16:9 YouTube thumbnail concept for ${input.channelName ?? "this creator"}.`,
      `Project: ${input.projectTitle ?? input.topic ?? "Untitled project"}.`,
      `Topic: ${input.topic ?? input.projectTitle ?? "Unknown topic"}.`,
      `Concept title: ${section.title}`,
      `Brief: ${section.body}`,
      "Use the provided reference thumbnails for tone and composition cues, but create a new original image.",
      "Make it clean, high-contrast, legible, emotionally clear, and optimized for CTR.",
      "Do not add watermarks or tiny unreadable text.",
    ].join("\n");

    const imageBuffer = await generateImageBuffer(prompt, input.referenceImages ?? []);
    const fileName = `${variant}.png`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, imageBuffer);

    const asset = await uploadAsset(job, {
      assetKind: "thumbnail_image",
      fileName,
      filePath,
      mimeType: "image/png",
      variant,
      metadata: {
        conceptTitle: section.title,
        prompt,
      },
    });
    assets.push(asset);

    await patchJob(job, {
      stage: "rendering",
      progress: Number((0.2 + ((index + 1) / sections.length) * 0.7).toFixed(3)),
      message: `Generated ${index + 1} of ${sections.length} thumbnail concepts`,
      output: {
        assets,
      },
    });
  }

  return {
    assetIds: assets.map((asset) => asset.id),
    assets,
    referenceCount: (input.referenceImages ?? []).length,
  };
}

async function handlePrevis(job: LeasedGenerationJob): Promise<JsonObject> {
  const input = job.input as PrevisJobInput;
  const outputDir = path.join(GENERATED_MEDIA_ROOT, job.id);
  ensureDir(outputDir);

  const scenes = buildScenePlan(input);
  const frameAssets: GenerationAsset[] = [];
  const framePaths: string[] = [];

  await patchJob(job, {
    stage: "storyboarding",
    progress: 0.05,
    message: "Generating storyboard frames",
  });

  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const variant = `scene-${index + 1}`;
    const imageBuffer = await generateImageBuffer(scene.prompt, input.referenceImages ?? []);
    const frameFileName = `${variant}.png`;
    const framePath = path.join(outputDir, frameFileName);
    fs.writeFileSync(framePath, imageBuffer);
    framePaths.push(framePath);

    const asset = await uploadAsset(job, {
      assetKind: "previs_frame",
      fileName: frameFileName,
      filePath: framePath,
      mimeType: "image/png",
      variant,
      metadata: {
        caption: scene.caption,
        prompt: scene.prompt,
        title: scene.title,
      },
    });
    frameAssets.push(asset);

    await patchJob(job, {
      stage: "storyboarding",
      progress: Number((0.1 + ((index + 1) / scenes.length) * 0.45).toFixed(3)),
      message: `Generated storyboard frame ${index + 1} of ${scenes.length}`,
      output: {
        frameAssetIds: frameAssets.map((item) => item.id),
      },
    });
  }

  let audioAsset: GenerationAsset | null = null;
  let audioPath: string | null = null;
  try {
    await patchJob(job, {
      stage: "voicing",
      progress: 0.6,
      message: "Generating temporary voiceover",
    });

    audioPath = await maybeGenerateSpeech(input.scriptContent ?? "", outputDir);
    if (audioPath) {
      audioAsset = await uploadAsset(job, {
        assetKind: "previs_audio",
        fileName: "voiceover.wav",
        filePath: audioPath,
        mimeType: "audio/wav",
        variant: "rough-voiceover",
        metadata: {
          model: GEMINI_TTS_MODEL,
          voice: GEMINI_TTS_VOICE,
        },
      });
    }
  } catch (error) {
    console.warn("Temporary voiceover generation failed, continuing with silent previs.", error);
  }

  await patchJob(job, {
    stage: "rendering",
    progress: 0.72,
    message: "Rendering rough cut",
  });

  const segmentPaths: string[] = [];
  for (let index = 0; index < framePaths.length; index += 1) {
    const segmentPath = path.join(outputDir, `segment-${index + 1}.mp4`);
    await createVideoSegment(framePaths[index], segmentPath);
    segmentPaths.push(segmentPath);
  }

  const silentVideoPath = path.join(outputDir, "previs-silent.mp4");
  await concatVideoSegments(segmentPaths, silentVideoPath);

  const finalVideoPath = path.join(outputDir, "previs.mp4");
  if (audioPath) {
    await muxAudio(silentVideoPath, audioPath, finalVideoPath);
  } else {
    fs.copyFileSync(silentVideoPath, finalVideoPath);
  }

  const videoAsset = await uploadAsset(job, {
    assetKind: "previs_video",
    fileName: "previs.mp4",
    filePath: finalVideoPath,
    mimeType: "video/mp4",
    variant: "rough-cut",
    metadata: {
      durationSeconds: framePaths.length * PREVIS_SCENE_DURATION_SECONDS,
      hasVoiceover: Boolean(audioPath),
      sceneCount: scenes.length,
    },
  });

  return {
    audioAssetId: audioAsset?.id ?? null,
    frameAssetIds: frameAssets.map((item) => item.id),
    hasVoiceover: Boolean(audioPath),
    sceneCount: scenes.length,
    videoAssetId: videoAsset.id,
  };
}

async function withHeartbeat<T>(job: LeasedGenerationJob, work: () => Promise<T>): Promise<T> {
  const timer = setInterval(() => {
    void heartbeatJob(job).catch((error) => {
      console.warn(`Heartbeat failed for generation job ${job.id}:`, error);
    });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

async function processJob(job: LeasedGenerationJob): Promise<void> {
  const outputDir = path.join(GENERATED_MEDIA_ROOT, job.id);
  ensureDir(outputDir);

  const result = await withHeartbeat(job, async () => {
    switch (job.jobType) {
      case "thumbnail_images":
        return await handleThumbnailImages(job);
      case "previs":
        return await handlePrevis(job);
      default:
        throw new Error(`Unsupported generation job type: ${job.jobType}`);
    }
  });

  await completeJob(job, {
    stage: "completed",
    message: `Completed ${job.jobType} generation`,
    output: result,
  });
}

async function resolveTargetJob(requestedJobId: string | undefined): Promise<LeasedGenerationJob | null> {
  if (requestedJobId) {
    return await leaseJob(requestedJobId);
  }

  return await leaseJob();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "job-id": { type: "string" },
      once: { type: "boolean", default: false },
      "poll-interval-seconds": { type: "string" },
    },
  });

  const pollInterval =
    values["poll-interval-seconds"] && Number.isFinite(Number(values["poll-interval-seconds"]))
      ? Number(values["poll-interval-seconds"]) * 1000
      : POLL_INTERVAL_MS;

  do {
    const job = await resolveTargetJob(values["job-id"]);
    if (!job) {
      if (values.once || values["job-id"]) {
        console.log("No matching generation job found.");
        return;
      }

      console.log(`No queued generation jobs. Sleeping for ${pollInterval / 1000}s.`);
      await sleep(pollInterval);
      continue;
    }

    try {
      await processJob(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(job, {
        stage: "failed",
        message: compactMessage(message) ?? "Generation job failed",
      });
      throw error;
    }

    if (values.once || values["job-id"]) {
      return;
    }
  } while (true);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
