import type { Ai, VectorizeIndex } from "@cloudflare/workers-types";

export type Env = {
  AI?: Ai;
  ALLOWED_ORIGINS?: string;
  ASSETS?: R2Bucket;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  DB: D1Database;
  DEFAULT_CHANNEL_SLUG?: string;
  INTERNAL_RUNNER_TOKEN?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
  TRANSCRIPTS_INDEX?: VectorizeIndex;
};
