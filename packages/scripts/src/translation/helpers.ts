export type TranscriptSegmentPayload = {
  endTime: number;
  segmentIndex: number;
  startTime: number;
  text: string;
};

export type TranslationBatch = {
  segments: TranscriptSegmentPayload[];
  startIndex: number;
};

const DEFAULT_MAX_BATCH_CHARACTERS = 2600;
const DEFAULT_MAX_BATCH_SEGMENTS = 18;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function padTime(value: number, width = 2): string {
  return Math.floor(value).toString().padStart(width, "0");
}

function buildTimestamp(seconds: number, separator: "," | "."): string {
  const clamped = clampSeconds(seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const milliseconds = Math.round((clamped - Math.floor(clamped)) * 1000);

  return `${padTime(hours)}:${padTime(minutes)}:${padTime(secs)}${separator}${padTime(milliseconds, 3)}`;
}

export function chunkTranscriptSegments(
  segments: TranscriptSegmentPayload[],
  maxBatchCharacters = DEFAULT_MAX_BATCH_CHARACTERS,
  maxBatchSegments = DEFAULT_MAX_BATCH_SEGMENTS
): TranslationBatch[] {
  const batches: TranslationBatch[] = [];
  let current: TranscriptSegmentPayload[] = [];
  let currentCharacters = 0;
  let currentStartIndex = 0;

  segments.forEach((segment, index) => {
    const normalizedText = normalizeWhitespace(segment.text);
    if (!normalizedText) return;

    const normalizedSegment: TranscriptSegmentPayload = {
      ...segment,
      text: normalizedText,
    };
    const segmentCharacters = normalizedText.length;
    const shouldStartNewBatch =
      current.length > 0 &&
      (current.length >= maxBatchSegments ||
        currentCharacters + segmentCharacters > maxBatchCharacters);

    if (shouldStartNewBatch) {
      batches.push({
        segments: current,
        startIndex: currentStartIndex,
      });
      current = [];
      currentCharacters = 0;
      currentStartIndex = index;
    }

    if (current.length === 0) {
      currentStartIndex = index;
    }

    current.push(normalizedSegment);
    currentCharacters += segmentCharacters;
  });

  if (current.length > 0) {
    batches.push({
      segments: current,
      startIndex: currentStartIndex,
    });
  }

  return batches;
}

export function buildSubtitleTimestamp(seconds: number, format: "srt" | "vtt"): string {
  return buildTimestamp(seconds, format === "srt" ? "," : ".");
}

export function buildSrt(segments: TranscriptSegmentPayload[]): string {
  return segments
    .map((segment, index) => {
      const text = normalizeWhitespace(segment.text);
      return [
        String(index + 1),
        `${buildSubtitleTimestamp(segment.startTime, "srt")} --> ${buildSubtitleTimestamp(segment.endTime, "srt")}`,
        text,
      ].join("\n");
    })
    .join("\n\n")
    .trim();
}

export function buildVtt(segments: TranscriptSegmentPayload[]): string {
  const body = segments
    .map((segment) => {
      const text = normalizeWhitespace(segment.text);
      return [
        `${buildSubtitleTimestamp(segment.startTime, "vtt")} --> ${buildSubtitleTimestamp(segment.endTime, "vtt")}`,
        text,
      ].join("\n");
    })
    .join("\n\n")
    .trim();

  return `WEBVTT\n\n${body}`.trim();
}
