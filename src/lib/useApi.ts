"use client";

import useSWR from "swr";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

export type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** true while re-fetching in the background (data is still shown) */
  refreshing: boolean;
  reload: () => void;
};

type Options = {
  /** falsy → skip the fetch (e.g. until an fpsId is selected) */
  enabled?: boolean;
  method?: "GET" | "POST";
  body?: unknown;
  /** bump this number to force a re-fetch (e.g. a Refresh button) */
  refreshKey?: number;
};

async function fetcher<T>([url, method, bodyKey]: [
  string,
  string,
  string,
  ...unknown[],
]): Promise<T> {
  const res = await fetch(url, {
    method,
    ...(bodyKey
      ? { headers: { "Content-Type": "application/json" }, body: bodyKey }
      : {}),
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!json.ok) {
    throw new Error(json.error);
  }
  return json.data;
}

/**
 * Small SWR wrapper for the proxy routes — loading / error / data / reload.
 * SWR handles dedup and race conditions for free.
 */
export function useApi<T>(url: string, options: Options = {}): ApiState<T> {
  const { enabled = true, method = "GET", body, refreshKey = 0 } = options;
  const bodyKey = body === undefined ? "" : JSON.stringify(body);

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    enabled && url ? [url, method, bodyKey, refreshKey] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      keepPreviousData: true,
    },
  );

  return {
    data: data ?? null,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    loading: isLoading,
    refreshing: isValidating,
    reload: () => void mutate(),
  };
}
