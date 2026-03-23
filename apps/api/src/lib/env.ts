import type { Ai, VectorizeIndex } from "@cloudflare/workers-types";

export type Env = {
  AI?: Ai;
  ALLOWED_ORIGINS?: string;
  ASSETS?: R2Bucket;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  DB: D1Database;
  DEFAULT_CHANNEL_SLUG?: string;
  HF_API_TOKEN?: string;
  INTERNAL_RUNNER_TOKEN?: string;
  LAMBDA_API_KEY?: string;
  LAMBDA_DEFAULT_INSTANCE_TYPE?: string;
  LAMBDA_DEFAULT_REGION?: string;
  LAMBDA_SSH_KEY_NAMES?: string;
  LAMBDA_TRAINING_REPO_RAW_BASE?: string;
  PRIMARY_WORKSPACE_ID?: string;
  PRIMARY_WORKSPACE_NAME?: string;
  PRIMARY_WORKSPACE_SLUG?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
  SCRIPT_LAB_TEXT_MODEL?: string;
  SINGLE_TENANT_MODE?: string;
  TRANSCRIPTS_INDEX?: VectorizeIndex;
};
