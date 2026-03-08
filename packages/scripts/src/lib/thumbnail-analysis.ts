import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, Type } from "@google/genai";

export const THUMBNAIL_ANALYSIS_PROGRESS_PREFIX = "YTSCAN_THUMBNAIL_PROGRESS";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";

export type ThumbnailAnalysisRecord = {
  clarityScore: number | null;
  compositionStyle: string;
  dominantColors: string[];
  expression: string | null;
  faceCount: number;
  hasFace: boolean;
  modelKey: string;
  objects: string[];
  primarySubject: string | null;
  provider: "gemini";
  textOverlay: string | null;
  textOverlayPresent: boolean;
  textPosition: string;
  textSize: string;
  visualHook: string | null;
  whyItWorks: string | null;
};

export type ThumbnailAnalysisCacheEntry = {
  analysis: ThumbnailAnalysisRecord;
  analyzedAt: string;
  sourceThumbnailPath: string;
  youtubeId: string;
};

type AnalyzeThumbnailParams = {
  channelName: string;
  title: string;
  thumbnailPath: string;
};

const THUMBNAIL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    textOverlay: { type: Type.STRING, nullable: true },
    textOverlayPresent: { type: Type.BOOLEAN },
    textPosition: { type: Type.STRING },
    textSize: { type: Type.STRING },
    hasFace: { type: Type.BOOLEAN },
    faceCount: { type: Type.INTEGER },
    expression: { type: Type.STRING, nullable: true },
    dominantColors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    compositionStyle: { type: Type.STRING },
    primarySubject: { type: Type.STRING, nullable: true },
    objects: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    visualHook: { type: Type.STRING, nullable: true },
    whyItWorks: { type: Type.STRING, nullable: true },
    clarityScore: { type: Type.INTEGER, nullable: true },
  },
  required: [
    "textOverlay",
    "textOverlayPresent",
    "textPosition",
    "textSize",
    "hasFace",
    "faceCount",
    "expression",
    "dominantColors",
    "compositionStyle",
    "primarySubject",
    "objects",
    "visualHook",
    "whyItWorks",
    "clarityScore",
  ],
} as const;

function compactText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 400) : null;
}

function normalizeStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeInteger(value: unknown, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function normalizeEnum(
  value: unknown,
  allowed: readonly string[],
  fallback: string
): string {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return allowed.includes(normalized) ? normalized : fallback;
}

function parseJsonPayload(response: unknown): Record<string, unknown> {
  const payload = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    text?: string;
  };
  const directText = typeof payload.text === "string" ? payload.text.trim() : "";
  const candidateText =
    payload.candidates
      ?.flatMap((candidate: { content?: { parts?: Array<{ text?: string }> } }) => candidate.content?.parts ?? [])
      .find((part: { text?: string }) => typeof part.text === "string" && part.text.trim().length > 0)
      ?.text?.trim() ?? "";
  const text = directText || candidateText;

  if (!text) {
    throw new Error("Gemini thumbnail analysis returned no JSON payload.");
  }

  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Gemini thumbnail analysis returned an invalid payload.");
  }

  return parsed as Record<string, unknown>;
}

function mimeTypeFromPath(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export function normalizeThumbnailAnalysis(
  payload: Record<string, unknown>,
  modelKey = DEFAULT_GEMINI_MODEL
): ThumbnailAnalysisRecord {
  const textOverlay = compactText(typeof payload.textOverlay === "string" ? payload.textOverlay : null);
  const hasFace = Boolean(payload.hasFace);

  return {
    clarityScore:
      payload.clarityScore === null || payload.clarityScore === undefined
        ? null
        : normalizeInteger(payload.clarityScore, 1, 10),
    compositionStyle: normalizeEnum(
      payload.compositionStyle,
      [
        "close_up",
        "talking_head",
        "object_focus",
        "split_scene",
        "text_heavy",
        "chart_graphic",
        "map_document",
        "collage",
        "other",
      ],
      "other"
    ),
    dominantColors: normalizeStringList(payload.dominantColors, 5),
    expression: hasFace
      ? normalizeEnum(
          payload.expression,
          [
            "neutral",
            "confident",
            "smiling",
            "surprised",
            "skeptical",
            "serious",
            "intense",
            "other",
          ],
          "other"
        )
      : null,
    faceCount: hasFace ? normalizeInteger(payload.faceCount, 1, 5) : 0,
    hasFace,
    modelKey,
    objects: normalizeStringList(payload.objects, 6),
    primarySubject: compactText(
      typeof payload.primarySubject === "string" ? payload.primarySubject : null
    ),
    provider: "gemini",
    textOverlay,
    textOverlayPresent: Boolean(payload.textOverlayPresent || textOverlay),
    textPosition: normalizeEnum(
      payload.textPosition,
      ["none", "top", "bottom", "left", "right", "center", "mixed"],
      textOverlay ? "mixed" : "none"
    ),
    textSize: normalizeEnum(
      payload.textSize,
      ["none", "small", "medium", "large"],
      textOverlay ? "medium" : "none"
    ),
    visualHook: compactText(typeof payload.visualHook === "string" ? payload.visualHook : null),
    whyItWorks: compactText(typeof payload.whyItWorks === "string" ? payload.whyItWorks : null),
  };
}

export async function analyzeThumbnail(
  params: AnalyzeThumbnailParams
): Promise<ThumbnailAnalysisRecord> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for thumbnail analysis.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const fileBuffer = fs.readFileSync(params.thumbnailPath);
  const mimeType = mimeTypeFromPath(params.thumbnailPath);

  const prompt = [
    "Analyze this YouTube thumbnail for content-intelligence use.",
    `Channel: ${params.channelName}`,
    `Video title: ${params.title}`,
    "Return structured JSON only.",
    "Use these enums exactly when applicable:",
    "- textPosition: none, top, bottom, left, right, center, mixed",
    "- textSize: none, small, medium, large",
    "- compositionStyle: close_up, talking_head, object_focus, split_scene, text_heavy, chart_graphic, map_document, collage, other",
    "- expression: neutral, confident, smiling, surprised, skeptical, serious, intense, other",
    "dominantColors should be 1-5 concise color names.",
    "objects should be 0-6 concise nouns.",
    "textOverlay should contain only the visible text, not inferred copy.",
    "whyItWorks should be a short product-useful note, not generic praise.",
  ].join("\n");

  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: fileBuffer.toString("base64"),
              mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: THUMBNAIL_SCHEMA,
    },
  });

  return normalizeThumbnailAnalysis(parseJsonPayload(response), DEFAULT_GEMINI_MODEL);
}

export function loadThumbnailAnalysisCache(
  cachePath: string
): Map<string, ThumbnailAnalysisCacheEntry> {
  if (!fs.existsSync(cachePath)) return new Map();

  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as {
      items?: ThumbnailAnalysisCacheEntry[];
    };

    return new Map(
      (parsed.items ?? [])
        .filter((entry) => entry && typeof entry.youtubeId === "string")
        .map((entry) => [entry.youtubeId, entry])
    );
  } catch {
    return new Map();
  }
}

export function persistThumbnailAnalysisCache(
  cachePath: string,
  cache: Map<string, ThumbnailAnalysisCacheEntry>
): void {
  fs.writeFileSync(
    cachePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        items: [...cache.values()].sort((left, right) => left.youtubeId.localeCompare(right.youtubeId)),
      },
      null,
      2
    )
  );
}
