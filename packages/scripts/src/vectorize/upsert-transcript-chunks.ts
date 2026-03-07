import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../../");

dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(MONOREPO_ROOT, ".env") });

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AI_TOKEN;
const VECTORIZE_INDEX = process.env.CLOUDFLARE_VECTORIZE_INDEX || "ytscan-transcripts";
const EMBEDDING_MODEL = process.env.CLOUDFLARE_EMBEDDING_MODEL || "@cf/baai/bge-m3";
const BATCH_SIZE = Number(process.env.VECTORIZE_BATCH_SIZE || "16");
const MAX_RETRIES = Number(process.env.VECTORIZE_MAX_RETRIES || "4");
const DEFAULT_INPUT = path.resolve(
  MONOREPO_ROOT,
  "data/channels/codie-sanchez/exports/codie-sanchez.transcript-chunks.ndjson"
);
const DEFAULT_CHECKPOINT = path.resolve(
  MONOREPO_ROOT,
  "data/channels/codie-sanchez/.checkpoints/vectorize-upsert.json"
);
const DEFAULT_FAILURE_LOG = path.resolve(
  MONOREPO_ROOT,
  "data/channels/codie-sanchez/.logs/vectorize-upsert-failures.ndjson"
);

if (!ACCOUNT_ID) {
  console.error("Missing CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

if (!API_TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const encodedModel = encodeURIComponent(EMBEDDING_MODEL).replace(/%2F/g, "/");
const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${encodedModel}`;
const vectorEndpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${encodeURIComponent(
  VECTORIZE_INDEX
)}/upsert`;

type TranscriptChunkLine = {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
};

type Checkpoint = {
  nextIndex: number;
  inputPath: string;
  updatedAt: string;
};

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function loadCheckpoint(checkpointPath: string): Checkpoint | null {
  if (!fs.existsSync(checkpointPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(checkpointPath, "utf-8")) as Checkpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(checkpointPath: string, checkpoint: Checkpoint): void {
  ensureParentDir(checkpointPath);
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

function appendFailureLog(filePath: string, payload: Record<string, unknown>): void {
  ensureParentDir(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

async function postRequest(url: string, payload: unknown, label: string): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": typeof payload === "string" ? "application/x-ndjson" : "application/json",
        },
        body: typeof payload === "string" ? payload : JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = (await response.text()).slice(0, 500);
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        throw new Error(`${label} failed: ${response.status} ${text}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error(`${label} failed unexpectedly`);
}

function extractEmbeddings(json: any): number[][] {
  const vectors = json.result?.data || json.result?.output || json.result || json.data;
  if (!Array.isArray(vectors)) {
    throw new Error("Unexpected embedding response shape");
  }

  return vectors.map((entry: any) => {
    if (Array.isArray(entry)) return entry;
    if (Array.isArray(entry?.embedding)) return entry.embedding;
    throw new Error("Missing embedding array in response");
  });
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await postRequest(aiEndpoint, { text: texts }, "Workers AI");
  const json = await response.json();
  return extractEmbeddings(json);
}

async function upsertVectors(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>): Promise<void> {
  const body = vectors.map((item) => JSON.stringify(item)).join("\n");
  await postRequest(vectorEndpoint, body, "Vectorize upsert");
}

async function readLines(inputPath: string): Promise<TranscriptChunkLine[]> {
  return fs
    .readFileSync(inputPath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TranscriptChunkLine);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      input: { type: "string" },
      checkpoint: { type: "string" },
      "failure-log": { type: "string" },
      reset: { type: "boolean", default: false },
    },
  });

  const inputPath = values.input ? path.resolve(process.cwd(), values.input) : DEFAULT_INPUT;
  const checkpointPath = values.checkpoint ? path.resolve(process.cwd(), values.checkpoint) : DEFAULT_CHECKPOINT;
  const failureLogPath = values["failure-log"]
    ? path.resolve(process.cwd(), values["failure-log"])
    : DEFAULT_FAILURE_LOG;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Transcript NDJSON not found at ${inputPath}`);
  }

  const records = await readLines(inputPath);
  const checkpoint = values.reset ? null : loadCheckpoint(checkpointPath);
  let startIndex = checkpoint && checkpoint.inputPath === inputPath ? checkpoint.nextIndex : 0;

  console.log(`Upserting ${records.length} transcript chunks into ${VECTORIZE_INDEX}`);
  if (startIndex > 0) {
    console.log(`Resuming from chunk ${startIndex}`);
  }

  for (let index = startIndex; index < records.length; index += BATCH_SIZE) {
    const batch = records.slice(index, index + BATCH_SIZE);
    try {
      const embeddings = await generateEmbeddings(batch.map((item) => item.text));
      const payload = batch.map((item, batchIndex) => ({
        id: item.id,
        values: embeddings[batchIndex],
        metadata: item.metadata,
      }));
      await upsertVectors(payload);
      saveCheckpoint(checkpointPath, {
        nextIndex: index + batch.length,
        inputPath,
        updatedAt: new Date().toISOString(),
      });
      console.log(`Upserted ${index + batch.length}/${records.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendFailureLog(failureLogPath, {
        timestamp: new Date().toISOString(),
        inputPath,
        startIndex: index,
        batchSize: batch.length,
        error: message,
      });
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
