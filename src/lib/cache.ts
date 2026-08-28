/**
 * Small in-memory TTL cache — only for rarely-changing master data
 * (dealer list, FPS options). Resets on server restart, which is fine.
 *
 * Ration / stock / transaction data is NEVER cached here — it is always live.
 */

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) {
    return hit.value;
  }
  const value = await loader();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function invalidate(key: string): void {
  store.delete(key);
}

export const TTL = {
  sixHours: 6 * 60 * 60 * 1000,
  oneDay: 24 * 60 * 60 * 1000,
} as const;
