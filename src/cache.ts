import type { KVNamespace } from '@cloudflare/workers-types';

const memoryCache = new Map<string, { expires: number; value: any }>();

/**
 * Decorator that caches the result of an async function for the provided TTL (seconds).
 * Suitable for lightweight, idempotent fetches such as Google Sheets reads.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  ttlSeconds = 300,
  kv?: KVNamespace,
): T {
  const cachedFn = (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = `${fn.name}:${JSON.stringify(args)}`;

    // Prefer KV if provided
    if (kv) {
      const kvHit = await kv.get<ReturnType<T>>(key, { type: 'json' });
      if (kvHit !== null) {
        return kvHit;
      }
    } else {
      const memHit = memoryCache.get(key);
      const now = Date.now();
      if (memHit && memHit.expires > now) {
        return memHit.value as ReturnType<T>;
      }
    }

    const result = await fn(...args);

    if (kv) {
      await kv.put(key, JSON.stringify(result), { expirationTtl: ttlSeconds });
    } else {
      memoryCache.set(key, { expires: Date.now() + ttlSeconds * 1000, value: result });
    }

    return result as ReturnType<T>;
  }) as T;

  return cachedFn;
}