const memoryCache = new Map<string, { expires: number; value: any }>();

/**
 * Decorator that caches the result of an async function for the provided TTL (seconds).
 * Suitable for lightweight, idempotent fetches such as Google Sheets reads.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function withCache<T extends (...args: any[]) => Promise<any>>(fn: T, ttlSeconds = 300): T {
  // We return a function with the same signature as fn
  const cachedFn = (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = `${fn.name}:${JSON.stringify(args)}`;
    const hit = memoryCache.get(key);

    const now = Date.now();
    if (hit && hit.expires > now) {
      return hit.value as ReturnType<T>;
    }

    const result = await fn(...args);
    memoryCache.set(key, { expires: now + ttlSeconds * 1000, value: result });
    return result as ReturnType<T>;
  }) as T;

  return cachedFn;
}