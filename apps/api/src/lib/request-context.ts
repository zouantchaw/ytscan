import type { MeResponse, WorkspaceSummary } from "@ytscan/core";
import type { AuthSession } from "./auth";
import { createAuth } from "./auth";
import type { Env } from "./env";

type WorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
  role: string;
};

export type RequestContext = {
  session: NonNullable<AuthSession>;
  workspace: WorkspaceRow;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function workspaceSlugFromSession(session: NonNullable<AuthSession>): string {
  const emailPrefix = session.user.email.split("@")[0] ?? session.user.id;
  return slugify(session.user.name || emailPrefix || "workspace") || `workspace-${session.user.id.slice(0, 8)}`;
}

function workspaceNameFromSession(session: NonNullable<AuthSession>): string {
  const emailPrefix = session.user.email.split("@")[0] ?? "Workspace";
  const ownerName = session.user.name?.trim() || emailPrefix;
  return `${ownerName} Workspace`;
}

async function fetchMemberships(userId: string, env: Env): Promise<WorkspaceRow[]> {
  const { results = [] } = await env.DB.prepare(
    `
      SELECT
        w.id,
        w.slug,
        w.name,
        w.created_at,
        w.updated_at,
        wm.role
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = ?
      ORDER BY wm.created_at ASC
    `
  )
    .bind(userId)
    .all<WorkspaceRow>();

  return results;
}

async function attachUnassignedData(workspaceId: string, userId: string, env: Env): Promise<void> {
  await Promise.all([
    env.DB.prepare(
      `
        UPDATE channels
        SET workspace_id = COALESCE(workspace_id, ?)
        WHERE workspace_id IS NULL
      `
    )
      .bind(workspaceId)
      .run(),
    env.DB.prepare(
      `
        UPDATE scan_jobs
        SET
          workspace_id = COALESCE(workspace_id, ?),
          created_by_user_id = COALESCE(created_by_user_id, ?)
        WHERE workspace_id IS NULL OR created_by_user_id IS NULL
      `
    )
      .bind(workspaceId, userId)
      .run(),
  ]);
}

async function createDefaultWorkspace(
  session: NonNullable<AuthSession>,
  env: Env
): Promise<WorkspaceRow> {
  const workspaceId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const slugBase = workspaceSlugFromSession(session);
  const existing = await env.DB.prepare(`SELECT COUNT(*) AS count FROM workspaces WHERE slug = ?`)
    .bind(slugBase)
    .first<{ count: number }>();
  const slug = Number(existing?.count ?? 0) > 0 ? `${slugBase}-${session.user.id.slice(0, 8)}` : slugBase;

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO workspaces (id, slug, name, created_by_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).bind(
      workspaceId,
      slug,
      workspaceNameFromSession(session),
      session.user.id,
      createdAt,
      createdAt
    ),
    env.DB.prepare(
      `
        INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, 'owner', ?, ?)
      `
    ).bind(workspaceId, session.user.id, createdAt, createdAt),
  ]);

  await attachUnassignedData(workspaceId, session.user.id, env);

  return {
    created_at: createdAt,
    id: workspaceId,
    name: workspaceNameFromSession(session),
    role: "owner",
    slug,
    updated_at: createdAt,
  };
}

async function resolveWorkspace(
  request: Request,
  session: NonNullable<AuthSession>,
  env: Env
): Promise<WorkspaceRow> {
  const memberships = await fetchMemberships(session.user.id, env);
  const requestedWorkspaceId = request.headers.get("x-workspace-id")?.trim();

  if (requestedWorkspaceId) {
    const match = memberships.find((workspace) => workspace.id === requestedWorkspaceId);
    if (match) return match;
  }

  if (memberships[0]) return memberships[0];

  return createDefaultWorkspace(session, env);
}

function toWorkspaceSummary(workspace: WorkspaceRow): WorkspaceSummary {
  return {
    createdAt: workspace.created_at,
    id: workspace.id,
    name: workspace.name,
    role: workspace.role,
    slug: workspace.slug,
    updatedAt: workspace.updated_at,
  };
}

export async function getRequestContext(
  request: Request,
  env: Env
): Promise<RequestContext | null> {
  const auth = createAuth(env, request);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) return null;

  const workspace = await resolveWorkspace(request, session, env);
  return {
    session,
    workspace,
  };
}

export function buildMeResponse(context: RequestContext): MeResponse {
  return {
    user: {
      email: context.session.user.email,
      emailVerified: context.session.user.emailVerified,
      id: context.session.user.id,
      image: context.session.user.image ?? null,
      name: context.session.user.name,
    },
    workspace: toWorkspaceSummary(context.workspace),
  };
}
