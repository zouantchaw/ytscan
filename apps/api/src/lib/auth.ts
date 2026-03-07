import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";
import { Resend } from "resend";
import type { Env } from "./env";

const DEFAULT_DEV_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:8787",
  "http://localhost:8787",
];

function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function uniqueOrigins(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function getAllowedOrigins(env: Env): string[] {
  const configuredOrigins =
    env.ALLOWED_ORIGINS?.split(",")
      .map((origin) => parseOrigin(origin.trim()))
      .filter(Boolean) ?? [];

  return uniqueOrigins([
    ...DEFAULT_DEV_ORIGINS,
    ...configuredOrigins,
    parseOrigin(env.BETTER_AUTH_URL ?? ""),
  ]);
}

function getBaseUrl(env: Env): string {
  return env.BETTER_AUTH_URL?.trim() || "http://127.0.0.1:8787";
}

function getSenderIdentity(env: Env): string {
  if (env.RESEND_FROM_EMAIL?.trim()) {
    return env.RESEND_FROM_NAME?.trim()
      ? `${env.RESEND_FROM_NAME.trim()} <${env.RESEND_FROM_EMAIL.trim()}>`
      : env.RESEND_FROM_EMAIL.trim();
  }

  return "YTScan <onboarding@resend.dev>";
}

function buildMagicLinkEmail(url: string): { html: string; text: string } {
  const escapedUrl = url.replace(/"/g, "&quot;");

  return {
    html: [
      "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111827;\">",
      "<p style=\"font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;\">YTScan</p>",
      "<h1 style=\"font-size: 28px; line-height: 1.2; margin: 0 0 16px;\">Sign in to YTScan</h1>",
      "<p style=\"font-size: 16px; line-height: 1.6; margin: 0 0 24px; color: #374151;\">Use the secure magic link below to finish signing in. This link expires in 5 minutes.</p>",
      `<a href="${escapedUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 999px; font-weight: 600;">Sign in</a>`,
      `<p style="font-size: 14px; line-height: 1.6; margin: 24px 0 0; color: #6b7280;">If the button does not work, open this link directly:<br /><a href="${escapedUrl}" style="color: #111827; word-break: break-all;">${escapedUrl}</a></p>`,
      "</div>",
    ].join(""),
    text: `Sign in to YTScan:\n\n${url}\n\nThis link expires in 5 minutes.`,
  };
}

export function createAuth(env: Env) {
  const processEnv = (
    globalThis as typeof globalThis & {
      process?: {
        env: Record<string, string | undefined>;
      };
    }
  ).process?.env;

  if (env.BETTER_AUTH_SECRET?.trim()) {
    if (processEnv) processEnv.BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET.trim();
  }

  if (env.BETTER_AUTH_URL?.trim()) {
    if (processEnv) processEnv.BETTER_AUTH_URL = env.BETTER_AUTH_URL.trim();
  }

  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

  return betterAuth({
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
      useSecureCookies: getBaseUrl(env).startsWith("https://"),
    },
    appName: "YTScan",
    basePath: "/api/auth",
    baseURL: getBaseUrl(env),
    database: env.DB,
    emailAndPassword: {
      enabled: false,
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 5,
        sendMagicLink: async ({ email, url }) => {
          if (!resend) {
            throw new Error("RESEND_API_KEY is required to send magic links.");
          }

          const { html, text } = buildMagicLinkEmail(url);

          await resend.emails.send({
            from: getSenderIdentity(env),
            html,
            subject: "Your YTScan sign-in link",
            text,
            to: email,
          });
        },
      }),
    ],
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: getAllowedOrigins(env),
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
export type AuthSession = Awaited<ReturnType<AuthInstance["api"]["getSession"]>>;
