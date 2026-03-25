import type { MeResponse, WorkspaceSummary } from "@ytscan/core";
import type { AuthSession } from "./auth";
import { createAuth } from "./auth";
import type { Env } from "./env";

type WorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  created_by_user_id?: string;
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

function isSingleTenantMode(env: Env): boolean {
  const value = env.SINGLE_TENANT_MODE?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes" || value === "on";
}

function getPrimaryWorkspaceSlug(env: Env): string {
  return env.PRIMARY_WORKSPACE_SLUG?.trim() || "ytscan-studio";
}

function getPrimaryWorkspaceName(env: Env): string {
  return env.PRIMARY_WORKSPACE_NAME?.trim() || "YTScan Studio";
}

async function fetchWorkspaceById(workspaceId: string, env: Env): Promise<WorkspaceRow | null> {
  return (
    (await env.DB.prepare(
      `
        SELECT
          id,
          slug,
          name,
          created_by_user_id,
          created_at,
          updated_at,
          'member' AS role
        FROM workspaces
        WHERE id = ?
      `
    )
      .bind(workspaceId)
      .first<WorkspaceRow>()) ?? null
  );
}

async function fetchWorkspaceBySlug(slug: string, env: Env): Promise<WorkspaceRow | null> {
  return (
    (await env.DB.prepare(
      `
        SELECT
          id,
          slug,
          name,
          created_by_user_id,
          created_at,
          updated_at,
          'member' AS role
        FROM workspaces
        WHERE slug = ?
      `
    )
      .bind(slug)
      .first<WorkspaceRow>()) ?? null
  );
}

async function fetchWorkspaceMembership(
  workspaceId: string,
  userId: string,
  env: Env
): Promise<WorkspaceRow | null> {
  return (
    (await env.DB.prepare(
      `
        SELECT
          w.id,
          w.slug,
          w.name,
          w.created_by_user_id,
          w.created_at,
          w.updated_at,
          wm.role
        FROM workspaces w
        JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE w.id = ? AND wm.user_id = ?
      `
    )
      .bind(workspaceId, userId)
      .first<WorkspaceRow>()) ?? null
  );
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

async function ensureWorkspaceMembership(
  workspace: WorkspaceRow,
  session: NonNullable<AuthSession>,
  env: Env
): Promise<WorkspaceRow> {
  const existingMembership = await fetchWorkspaceMembership(workspace.id, session.user.id, env);
  if (existingMembership) return existingMembership;

  const createdAt = new Date().toISOString();
  const role = workspace.created_by_user_id === session.user.id ? "owner" : "member";

  await env.DB.prepare(
    `
      INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `
  )
    .bind(workspace.id, session.user.id, role, createdAt, createdAt)
    .run();

  return (
    (await fetchWorkspaceMembership(workspace.id, session.user.id, env)) ?? {
      ...workspace,
      role,
    }
  );
}

async function updatePrimaryWorkspaceMetadata(
  workspace: WorkspaceRow,
  env: Env
): Promise<WorkspaceRow> {
  const desiredSlug = getPrimaryWorkspaceSlug(env);
  const desiredName = getPrimaryWorkspaceName(env);

  if (workspace.slug === desiredSlug && workspace.name === desiredName) {
    return workspace;
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `
      UPDATE workspaces
      SET slug = ?, name = ?, updated_at = ?
      WHERE id = ?
    `
  )
    .bind(desiredSlug, desiredName, now, workspace.id)
    .run();

  return {
    ...workspace,
    name: desiredName,
    slug: desiredSlug,
    updated_at: now,
  };
}

async function resolveOrCreatePrimaryWorkspace(
  session: NonNullable<AuthSession>,
  env: Env
): Promise<WorkspaceRow> {
  const configuredWorkspaceId = env.PRIMARY_WORKSPACE_ID?.trim();
  const configuredWorkspaceSlug = getPrimaryWorkspaceSlug(env);
  const configuredWorkspaceName = getPrimaryWorkspaceName(env);
  const createdAt = new Date().toISOString();

  let workspace =
    (configuredWorkspaceId
      ? await fetchWorkspaceById(configuredWorkspaceId, env)
      : null) ?? (await fetchWorkspaceBySlug(configuredWorkspaceSlug, env));

  if (!workspace) {
    const workspaceId = configuredWorkspaceId || crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `
          INSERT INTO workspaces (id, slug, name, created_by_user_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      ).bind(
        workspaceId,
        configuredWorkspaceSlug,
        configuredWorkspaceName,
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

    // In single-tenant mode we intentionally sweep legacy unassigned data
    // into the shared studio so the existing corpus remains accessible.
    await attachUnassignedData(workspaceId, session.user.id, env);

    workspace = {
      created_at: createdAt,
      created_by_user_id: session.user.id,
      id: workspaceId,
      name: configuredWorkspaceName,
      role: "owner",
      slug: configuredWorkspaceSlug,
      updated_at: createdAt,
    };

    return workspace;
  }

  const normalizedWorkspace = await updatePrimaryWorkspaceMetadata(workspace, env);
  // Keep legacy single-tenant behavior only for the shared studio path.
  await attachUnassignedData(normalizedWorkspace.id, session.user.id, env);
  return ensureWorkspaceMembership(normalizedWorkspace, session, env);
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
  if (isSingleTenantMode(env)) {
    return resolveOrCreatePrimaryWorkspace(session, env);
  }

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
