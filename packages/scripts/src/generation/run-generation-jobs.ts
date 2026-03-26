import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  buildSrt,
  buildVtt,
  chunkTranscriptSegments,
  type TranscriptSegmentPayload,
} from "../translation/helpers.js";

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
const GEMINI_PREVIS_IMAGE_MODEL =
  process.env.GEMINI_PREVIS_IMAGE_MODEL || process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const GEMINI_THUMBNAIL_IMAGE_MODEL =
  process.env.GEMINI_THUMBNAIL_IMAGE_MODEL ||
  process.env.GEMINI_IMAGE_MODEL ||
  "gemini-3-pro-image-preview";
const GEMINI_TRANSLATION_MODEL = process.env.GEMINI_TRANSLATION_MODEL || "gemini-2.5-flash";
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";
const PREVIS_SCENE_DURATION_SECONDS = Number(process.env.PREVIS_SCENE_DURATION_SECONDS || "5");
const WHISPER_MODEL_SIZE = process.env.WHISPER_MODEL_SIZE || "small";
const WHISPER_COMPUTE_TYPE = process.env.WHISPER_COMPUTE_TYPE || "int8";
const WHISPER_DEVICE = process.env.WHISPER_DEVICE || "cpu";
const GENERATED_MEDIA_ROOT = path.resolve(MONOREPO_ROOT, "data/generated-media");

type JsonObject = Record<string, unknown>;

type GenerationJob = {
  id: string;
  projectId: string | null;
  personaModelId: string | null;
  uploadedMediaId: string | null;
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

type TranscriptionJobInput = {
  fileName?: string;
  mediaId?: string;
  mimeType?: string;
  r2Key?: string | null;
};

type ScenePlan = {
  caption: string;
  prompt: string;
  title: string;
};

type TranslationJobInput = {
  mediaId?: string;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  translationId?: string;
};

type TranslationSourcePayload = {
  media: {
    id: string;
    fileName: string;
    language: string | null;
    transcriptText: string;
    transcriptWordCount: number;
    durationSec: number | null;
  };
  translation: {
    id: string;
    sourceLanguage: string | null;
    targetLanguage: string;
    provider: string;
  };
  segments: TranscriptSegmentPayload[];
};

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const ENABLED_MEDIA_JOB_TYPES = ai
  ? ["thumbnail_images", "previs", "transcription", "translation"]
  : ["transcription"];
const ENABLED_MEDIA_PROVIDERS = ai ? ["gemini", "internal"] : ["internal"];

function assertWorkerEnvironment(): void {
  const missing: string[] = [];

  if (!INTERNAL_RUNNER_TOKEN) {
    missing.push("INTERNAL_RUNNER_TOKEN");
  }

  if (missing.length) {
    throw new Error(`Missing required media worker env: ${missing.join(", ")}`);
  }
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
      body: JSON.stringify(
        jobId
          ? {
              jobId,
              jobTypes: ENABLED_MEDIA_JOB_TYPES,
              providers: ENABLED_MEDIA_PROVIDERS,
            }
          : {
              jobTypes: ENABLED_MEDIA_JOB_TYPES,
              providers: ENABLED_MEDIA_PROVIDERS,
            }
      ),
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

async function downloadTranscriptionSource(job: LeasedGenerationJob, outputDir: string): Promise<string> {
  const headers = new Headers();
  headers.set("x-internal-token", INTERNAL_RUNNER_TOKEN);
  headers.set("x-generation-lease-token", job.leaseToken);

  const response = await fetch(`${API_BASE_URL}/api/internal/generation-jobs/${job.id}/source`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Source download failed (${response.status} ${response.statusText}): ${await response.text()}`);
  }

  const contentDisposition = response.headers.get("content-disposition") || "";
  const match = contentDisposition.match(/filename="([^"]+)"/);
  const fileName = sanitizeName(match?.[1] || `${job.uploadedMediaId ?? job.id}.bin`);
  const filePath = path.join(outputDir, fileName);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function syncTranscriptResult(
  job: LeasedGenerationJob,
  payload: {
    durationSec: number | null;
    language: string | null;
    segments: Array<{ endTime: number; segmentIndex: number; startTime: number; text: string }>;
    transcriptText: string;
  }
): Promise<void> {
  await apiJsonRequest(`/api/internal/generation-jobs/${job.id}/transcript`, {
    method: "POST",
    body: JSON.stringify({
      leaseToken: job.leaseToken,
      ...payload,
    }),
  });
}

async function fetchTranslationSource(job: LeasedGenerationJob): Promise<TranslationSourcePayload> {
  const headers = new Headers();
  headers.set("x-internal-token", INTERNAL_RUNNER_TOKEN);
  headers.set("x-generation-lease-token", job.leaseToken);

  const response = await fetch(
    `${API_BASE_URL}/api/internal/generation-jobs/${job.id}/translation-source`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Translation source fetch failed (${response.status} ${response.statusText}): ${await response.text()}`
    );
  }

  return (await response.json()) as TranslationSourcePayload;
}

async function syncTranslationResult(
  job: LeasedGenerationJob,
  payload: {
    segments: TranscriptSegmentPayload[];
    sourceLanguage: string | null;
    targetLanguage: string | null;
    translatedText: string;
  }
): Promise<void> {
  await apiJsonRequest(`/api/internal/generation-jobs/${job.id}/translation`, {
    method: "POST",
    body: JSON.stringify({
      leaseToken: job.leaseToken,
      ...payload,
    }),
  });
}

async function runPythonJson(command: string, args: string[], cwd = MONOREPO_ROOT): Promise<JsonObject> {
  return await new Promise<JsonObject>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk.toString());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }

      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const jsonLine = [...lines].reverse().find((line) => line.startsWith("{") && line.endsWith("}"));
      if (!jsonLine) {
        reject(new Error(`Expected JSON output from ${command} but none was found.`));
        return;
      }

      try {
        resolve(JSON.parse(jsonLine) as JsonObject);
      } catch (error) {
        reject(error);
      }
    });
  });
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

function extractTextFromModelResponse(response: unknown): string | null {
  const payload = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    text?: string;
  };

  const directText = typeof payload.text === "string" ? payload.text.trim() : "";
  if (directText) return directText;

  const candidateText = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  return candidateText || null;
}

const TRANSLATION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    translatedText: { type: Type.STRING },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          segmentIndex: { type: Type.INTEGER },
          text: { type: Type.STRING },
        },
        required: ["segmentIndex", "text"],
      },
    },
  },
  required: ["translatedText", "segments"],
} as const;

async function translateBatch(
  batch: TranscriptSegmentPayload[],
  sourceLanguage: string | null,
  targetLanguage: string
): Promise<{
  translatedText: string;
  segments: Array<{ segmentIndex: number; text: string }>;
}> {
  if (!ai) {
    throw new Error("GEMINI_API_KEY is required for translation jobs.");
  }

  const prompt = [
    `Translate the following transcript segments from ${sourceLanguage ?? "the source language"} to ${targetLanguage}.`,
    "Return valid JSON that matches the schema exactly.",
    "Rules:",
    "- Preserve the original segmentIndex values.",
    "- Return one translated segment for every input segment.",
    "- Do not summarize or omit details.",
    "- Keep the wording natural and spoken, suitable for subtitles/transcripts.",
    "- Do not add commentary, labels, or markdown.",
    "",
    JSON.stringify({
      segments: batch.map((segment) => ({
        segmentIndex: segment.segmentIndex,
        text: segment.text,
      })),
    }),
  ].join("\n");

  const response = await ai.models.generateContent({
    model: GEMINI_TRANSLATION_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: TRANSLATION_RESPONSE_SCHEMA,
    },
  });

  const text = extractTextFromModelResponse(response);
  if (!text) {
    throw new Error("Gemini translation returned no JSON payload.");
  }

  let parsed: {
    translatedText?: unknown;
    segments?: Array<{ segmentIndex?: unknown; text?: unknown }>;
  };
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Gemini translation returned invalid JSON: ${String(error)}`);
  }

  const translatedSegments = Array.isArray(parsed.segments)
    ? parsed.segments
        .map((segment) => {
          const segmentIndex = Number(segment?.segmentIndex);
          const translatedText = typeof segment?.text === "string" ? segment.text.trim() : "";
          if (!Number.isFinite(segmentIndex) || !translatedText) {
            return null;
          }
          return {
            segmentIndex,
            text: translatedText,
          };
        })
        .filter((segment): segment is { segmentIndex: number; text: string } => Boolean(segment))
    : [];

  const batchByIndex = new Map(batch.map((segment) => [segment.segmentIndex, segment]));
  if (translatedSegments.length !== batch.length) {
    throw new Error("Gemini translation returned a mismatched segment count.");
  }

  for (const segment of translatedSegments) {
    if (!batchByIndex.has(segment.segmentIndex)) {
      throw new Error("Gemini translation returned an unexpected segment index.");
    }
  }

  const translatedText =
    typeof parsed.translatedText === "string" && parsed.translatedText.trim()
      ? parsed.translatedText.trim()
      : translatedSegments.map((segment) => segment.text).join(" ");

  return {
    translatedText,
    segments: translatedSegments.sort((left, right) => left.segmentIndex - right.segmentIndex),
  };
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
    ? sections.slice(0, 2)
    : [
        { title: "Concept 1", body: briefContent.trim() },
        { title: "Concept 2", body: briefContent.trim() },
      ];
}

async function generateImageBuffer(
  prompt: string,
  referenceImages: ReferenceImage[],
  model: string
): Promise<Buffer> {
  if (!ai) {
    throw new Error("GEMINI_API_KEY is required for media generation.");
  }

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: prompt },
    ...(await fetchReferenceImageParts(referenceImages)),
  ];

  const response = await ai.models.generateContent({
    model,
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

    const imageBuffer = await generateImageBuffer(
      prompt,
      input.referenceImages ?? [],
      GEMINI_THUMBNAIL_IMAGE_MODEL
    );
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
        model: GEMINI_THUMBNAIL_IMAGE_MODEL,
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
    const imageBuffer = await generateImageBuffer(
      scene.prompt,
      input.referenceImages ?? [],
      GEMINI_PREVIS_IMAGE_MODEL
    );
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
        model: GEMINI_PREVIS_IMAGE_MODEL,
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

async function handleTranscription(job: LeasedGenerationJob): Promise<JsonObject> {
  const input = job.input as TranscriptionJobInput;
  const outputDir = path.join(GENERATED_MEDIA_ROOT, job.id);
  ensureDir(outputDir);

  await patchJob(job, {
    stage: "downloading",
    progress: 0.05,
    message: "Downloading source media",
  });

  const sourcePath = await downloadTranscriptionSource(job, outputDir);

  await patchJob(job, {
    stage: "extracting_audio",
    progress: 0.18,
    message: "Preparing audio for transcription",
  });

  const scriptPath = path.resolve(MONOREPO_ROOT, "packages/scripts/src/transcription/transcribe_media.py");
  const result = await runPythonJson("python3", [
    scriptPath,
    "--input",
    sourcePath,
    "--output-dir",
    outputDir,
    "--model-size",
    WHISPER_MODEL_SIZE,
    "--compute-type",
    WHISPER_COMPUTE_TYPE,
    "--device",
    WHISPER_DEVICE,
  ]);

  const transcriptText =
    typeof result.transcriptText === "string" ? result.transcriptText : "";
  const rawSegments = Array.isArray(result.segments) ? result.segments : [];
  const segments = rawSegments
    .map((segment, index) => {
      if (!segment || typeof segment !== "object" || Array.isArray(segment)) return null;
      const value = segment as Record<string, unknown>;
      return {
        segmentIndex:
          value.segmentIndex === undefined || value.segmentIndex === null
            ? index
            : Number(value.segmentIndex),
        startTime: Number(value.startTime ?? 0),
        endTime: Number(value.endTime ?? 0),
        text: typeof value.text === "string" ? value.text : "",
      };
    })
    .filter((segment): segment is TranscriptSegmentPayload => {
      if (!segment) return false;
      return Boolean(segment.text.trim());
    });

  await patchJob(job, {
    stage: "transcribing",
    progress: 0.78,
    message: `Transcribed ${segments.length} segments`,
  });

  await syncTranscriptResult(job, {
    transcriptText,
    segments,
    language: typeof result.language === "string" ? result.language : null,
    durationSec:
      result.durationSec === undefined || result.durationSec === null ? null : Number(result.durationSec),
  });

  const fileMap =
    result.files && typeof result.files === "object" && !Array.isArray(result.files)
      ? (result.files as Record<string, unknown>)
      : {};
  const transcriptAssets: GenerationAsset[] = [];
  const uploads: Array<{ assetKind: string; key: string; mimeType: string }> = [
    { assetKind: "transcript_text", key: "txt", mimeType: "text/plain; charset=utf-8" },
    { assetKind: "transcript_srt", key: "srt", mimeType: "application/x-subrip" },
    { assetKind: "transcript_vtt", key: "vtt", mimeType: "text/vtt; charset=utf-8" },
    { assetKind: "transcript_json", key: "json", mimeType: "application/json; charset=utf-8" },
  ];

  await patchJob(job, {
    stage: "packaging",
    progress: 0.9,
    message: "Uploading transcript files",
  });

  for (const upload of uploads) {
    const rawFilePathValue = fileMap[upload.key];
    const filePathValue = typeof rawFilePathValue === "string" ? rawFilePathValue : null;
    if (!filePathValue || !fs.existsSync(filePathValue)) continue;
    const asset = await uploadAsset(job, {
      assetKind: upload.assetKind,
      fileName: path.basename(filePathValue),
      filePath: filePathValue,
      mimeType: upload.mimeType,
      metadata: {
        mediaId: job.uploadedMediaId,
      },
    });
    transcriptAssets.push(asset);
  }

  return {
    uploadedMediaId: job.uploadedMediaId,
    language: typeof result.language === "string" ? result.language : null,
    durationSec:
      result.durationSec === undefined || result.durationSec === null ? null : Number(result.durationSec),
    segmentCount: segments.length,
    transcriptAssetIds: transcriptAssets.map((asset) => asset.id),
    transcriptWordCount: transcriptText.trim() ? transcriptText.trim().split(/\s+/).length : 0,
  };
}

async function handleTranslation(job: LeasedGenerationJob): Promise<JsonObject> {
  const input = job.input as TranslationJobInput;
  const outputDir = path.join(GENERATED_MEDIA_ROOT, job.id);
  ensureDir(outputDir);

  await patchJob(job, {
    stage: "loading_source",
    progress: 0.05,
    message: "Loading transcript for translation",
  });

  const source = await fetchTranslationSource(job);
  const sourceLanguage = source.translation.sourceLanguage ?? source.media.language ?? input.sourceLanguage ?? null;
  const targetLanguage = source.translation.targetLanguage || input.targetLanguage || "en";

  const batches = chunkTranscriptSegments(source.segments);
  if (batches.length === 0) {
    throw new Error("No transcript segments are available for translation.");
  }

  const translatedSegments: TranscriptSegmentPayload[] = [];
  const translatedBatchTexts: string[] = [];

  await patchJob(job, {
    stage: "translating",
    progress: 0.12,
    message: `Translating ${source.segments.length} segments`,
  });

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const translated = await translateBatch(batch.segments, sourceLanguage, targetLanguage);
    const translatedByIndex = new Map(
      translated.segments.map((segment) => [segment.segmentIndex, segment.text])
    );

    for (const original of batch.segments) {
      const translatedText = translatedByIndex.get(original.segmentIndex);
      if (!translatedText) {
        throw new Error(`Missing translated text for segment ${original.segmentIndex}.`);
      }
      translatedSegments.push({
        ...original,
        text: translatedText,
      });
    }

    translatedBatchTexts.push(translated.translatedText);

    await patchJob(job, {
      stage: "translating",
      progress: Number((0.12 + ((index + 1) / batches.length) * 0.62).toFixed(3)),
      message: `Translated batch ${index + 1} of ${batches.length}`,
    });
  }

  const translatedText = translatedSegments.map((segment) => segment.text).join("\n").trim();
  await syncTranslationResult(job, {
    translatedText,
    sourceLanguage,
    targetLanguage,
    segments: translatedSegments,
  });

  const normalizedTargetLanguage = targetLanguage.toLowerCase();
  const artifactBaseName = `${sanitizeName(source.media.fileName.replace(/\.[^.]+$/, ""))}-${normalizedTargetLanguage}`;
  const txtPath = path.join(outputDir, `${artifactBaseName}.txt`);
  const srtPath = path.join(outputDir, `${artifactBaseName}.srt`);
  const vttPath = path.join(outputDir, `${artifactBaseName}.vtt`);
  const jsonPath = path.join(outputDir, `${artifactBaseName}.json`);

  fs.writeFileSync(txtPath, `${translatedText}\n`, "utf8");
  fs.writeFileSync(srtPath, `${buildSrt(translatedSegments)}\n`, "utf8");
  fs.writeFileSync(vttPath, `${buildVtt(translatedSegments)}\n`, "utf8");
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        media: source.media,
        translation: {
          id: source.translation.id,
          sourceLanguage,
          targetLanguage,
        },
        segments: translatedSegments,
        translatedText,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await patchJob(job, {
    stage: "packaging",
    progress: 0.84,
    message: "Uploading translated transcript files",
  });

  const assets: GenerationAsset[] = [];
  for (const upload of [
    {
      assetKind: "translation_text",
      fileName: path.basename(txtPath),
      filePath: txtPath,
      mimeType: "text/plain; charset=utf-8",
    },
    {
      assetKind: "translation_srt",
      fileName: path.basename(srtPath),
      filePath: srtPath,
      mimeType: "application/x-subrip",
    },
    {
      assetKind: "translation_vtt",
      fileName: path.basename(vttPath),
      filePath: vttPath,
      mimeType: "text/vtt; charset=utf-8",
    },
    {
      assetKind: "translation_json",
      fileName: path.basename(jsonPath),
      filePath: jsonPath,
      mimeType: "application/json; charset=utf-8",
    },
  ]) {
    assets.push(
      await uploadAsset(job, {
        ...upload,
        metadata: {
          mediaId: source.media.id,
          sourceLanguage,
          targetLanguage,
          translationId: source.translation.id,
        },
      })
    );
  }

  return {
    assetIds: assets.map((asset) => asset.id),
    mediaId: source.media.id,
    sourceLanguage,
    targetLanguage,
    translatedWordCount: translatedText ? translatedText.split(/\s+/).filter(Boolean).length : 0,
    translationAssetIds: assets.map((asset) => asset.id),
    translationId: source.translation.id,
    segmentCount: translatedSegments.length,
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
      case "transcription":
        return await handleTranscription(job);
      case "translation":
        return await handleTranslation(job);
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
  assertWorkerEnvironment();

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
