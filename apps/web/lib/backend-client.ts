"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export class BackendError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.payload = payload;
  }
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildBackendUrl(path: string) {
  return `/api/backend${normalizePath(path)}`;
}

export async function fetchBackend<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(buildBackendUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error ?? "Request failed")
        : "Request failed";
    throw new BackendError(message, response.status, payload);
  }

  return payload as T;
}

type QueryOptions = {
  enabled?: boolean;
  pollMs?: number | null;
};

export function useBackendQuery<T>(
  path: string | null,
  options?: QueryOptions
) {
  const enabled = options?.enabled ?? Boolean(path);
  const pollMs = options?.pollMs ?? null;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<BackendError | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [reloadToken, setReloadToken] = useState(0);

  const key = useMemo(() => `${path ?? ""}:${reloadToken}`, [path, reloadToken]);

  const refetch = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const requestPath = path;

    if (!requestPath || !enabled) {
      setIsLoading(false);
      return;
    }

    const resolvedPath: string = requestPath;

    let active = true;

    async function run() {
      try {
        setIsLoading(true);
        setError(null);
        const payload = await fetchBackend<T>(resolvedPath);
        if (!active) return;
        setData(payload);
      } catch (caughtError) {
        if (!active) return;
        setError(
          caughtError instanceof BackendError
            ? caughtError
            : new BackendError("Unknown request error", 500, null)
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    run();

    if (!pollMs) {
      return () => {
        active = false;
      };
    }

    const timer = window.setInterval(run, pollMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [key, enabled, path, pollMs]);

  return {
    data,
    error,
    isLoading,
    refetch,
  };
}
