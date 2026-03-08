import type { Env } from "./env";

type LambdaApiError = {
  error?: {
    code?: string;
    message?: string;
    suggestion?: string;
  };
};

type LambdaInstanceTypeRecord = {
  instance_type?: {
    description?: string;
    name?: string;
    price_cents_per_hour?: number;
    specs?: {
      gpus?: number;
      memory_gib?: number;
      storage_gib?: number;
      vcpus?: number;
    };
  };
  regions_with_capacity_available?: Array<{
    description?: string;
    name?: string;
  }>;
};

type LambdaInstanceTypesResponse = {
  data?: Record<string, LambdaInstanceTypeRecord>;
};

type LambdaSshKeysResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    public_key?: string;
  }>;
};

type LambdaLaunchResponse = {
  data?: {
    instance_ids?: string[];
  };
};

type LambdaTerminateResponse = {
  data?: {
    terminated_instances?: string[];
  };
};

export type LambdaLaunchPlan = {
  instanceTypeDescription: string | null;
  instanceTypeName: string;
  priceCentsPerHour: number | null;
  regionName: string;
  sshKeyNames: string[];
};

const LAMBDA_API_URL = "https://cloud.lambdalabs.com/api/v1";
const DEFAULT_INSTANCE_TYPE_ORDER = [
  "gpu_1x_a10",
  "gpu_1x_a100_sxm4",
  "gpu_1x_a100",
  "gpu_1x_rtx6000",
];

function parseCommaList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function lambdaRequest<T>(
  env: Env,
  pathname: string,
  options?: RequestInit
): Promise<T> {
  const apiKey = env.LAMBDA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LAMBDA_API_KEY is not configured.");
  }

  const response = await fetch(`${LAMBDA_API_URL}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & LambdaApiError;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Lambda API request failed with ${response.status}`;
    const suggestion = payload?.error?.suggestion ? ` ${payload.error.suggestion}` : "";
    throw new Error(`${message}${suggestion}`.trim());
  }

  return payload;
}

async function listInstanceTypes(env: Env): Promise<Record<string, LambdaInstanceTypeRecord>> {
  const payload = await lambdaRequest<LambdaInstanceTypesResponse>(env, "/instance-types");
  return payload.data ?? {};
}

async function listSshKeyNames(env: Env): Promise<string[]> {
  const payload = await lambdaRequest<LambdaSshKeysResponse>(env, "/ssh-keys");
  return (payload.data ?? [])
    .map((entry) => entry.name?.trim())
    .filter((value): value is string => Boolean(value));
}

function chooseInstanceType(
  instanceTypes: Record<string, LambdaInstanceTypeRecord>,
  preferredName?: string
): LambdaInstanceTypeRecord | null {
  const orderedNames = [
    preferredName?.trim() || null,
    ...DEFAULT_INSTANCE_TYPE_ORDER,
    ...Object.keys(instanceTypes),
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

  for (const name of orderedNames) {
    const candidate = instanceTypes[name];
    if (!candidate?.instance_type?.name) continue;
    if ((candidate.regions_with_capacity_available ?? []).length === 0) continue;
    return candidate;
  }

  return null;
}

export async function resolveLambdaLaunchPlan(
  env: Env,
  options?: {
    instanceTypeName?: string | null;
    regionName?: string | null;
    sshKeyNames?: string[] | null;
  }
): Promise<LambdaLaunchPlan> {
  const [instanceTypes, accountSshKeys] = await Promise.all([
    listInstanceTypes(env),
    listSshKeyNames(env),
  ]);

  const preferredInstanceType =
    options?.instanceTypeName?.trim() || env.LAMBDA_DEFAULT_INSTANCE_TYPE?.trim() || undefined;
  const candidate = chooseInstanceType(instanceTypes, preferredInstanceType);

  if (!candidate?.instance_type?.name) {
    throw new Error("No Lambda instance type with available capacity was found.");
  }

  const sshKeyNames =
    options?.sshKeyNames?.filter(Boolean).map((value) => value.trim()).filter(Boolean) ??
    parseCommaList(env.LAMBDA_SSH_KEY_NAMES);
  const resolvedSshKeys = sshKeyNames.length > 0 ? sshKeyNames : accountSshKeys.slice(0, 1);

  if (resolvedSshKeys.length === 0) {
    throw new Error("No Lambda SSH key is available. Add one in Lambda or set LAMBDA_SSH_KEY_NAMES.");
  }

  const capacityRegions = candidate.regions_with_capacity_available ?? [];
  const requestedRegion = options?.regionName?.trim() || env.LAMBDA_DEFAULT_REGION?.trim() || null;
  const resolvedRegion =
    (requestedRegion && capacityRegions.find((region) => region.name === requestedRegion)?.name) ||
    capacityRegions[0]?.name;

  if (!resolvedRegion) {
    throw new Error(`No available region found for Lambda instance type ${candidate.instance_type.name}.`);
  }

  return {
    instanceTypeDescription: candidate.instance_type.description ?? null,
    instanceTypeName: candidate.instance_type.name,
    priceCentsPerHour:
      candidate.instance_type.price_cents_per_hour === undefined
        ? null
        : Number(candidate.instance_type.price_cents_per_hour),
    regionName: resolvedRegion,
    sshKeyNames: resolvedSshKeys.slice(0, 1),
  };
}

export async function launchLambdaInstance(
  env: Env,
  options: LambdaLaunchPlan & {
    name?: string | null;
    tags?: Array<{ key: string; value: string }>;
    userData?: string | null;
  }
): Promise<{ instanceIds: string[]; raw: unknown }> {
  const body = {
    region_name: options.regionName,
    instance_type_name: options.instanceTypeName,
    ssh_key_names: options.sshKeyNames,
    ...(options.name?.trim() ? { name: options.name.trim() } : {}),
    ...(options.userData?.trim() ? { user_data: options.userData.trim() } : {}),
    ...(options.tags?.length ? { tags: options.tags } : {}),
  };

  const payload = await lambdaRequest<LambdaLaunchResponse>(env, "/instance-operations/launch", {
    body: JSON.stringify(body),
    method: "POST",
  });

  return {
    instanceIds: payload.data?.instance_ids ?? [],
    raw: payload,
  };
}

export async function terminateLambdaInstances(
  env: Env,
  instanceIds: string[]
): Promise<{ terminatedInstanceIds: string[]; raw: unknown }> {
  const cleanedInstanceIds = instanceIds.map((value) => value.trim()).filter(Boolean);
  if (!cleanedInstanceIds.length) {
    return { terminatedInstanceIds: [], raw: { skipped: true } };
  }

  const payload = await lambdaRequest<LambdaTerminateResponse>(env, "/instance-operations/terminate", {
    body: JSON.stringify({
      instance_ids: cleanedInstanceIds,
    }),
    method: "POST",
  });

  return {
    terminatedInstanceIds: payload.data?.terminated_instances ?? cleanedInstanceIds,
    raw: payload,
  };
}
