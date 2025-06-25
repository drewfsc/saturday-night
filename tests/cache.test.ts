import { describe, it, expect, vi } from 'vitest';
import { withCache } from '../src/cache';

// Helper that waits a bit
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe('withCache decorator', () => {
  it('returns cached result within TTL', async () => {
    let invocation = 0;
    const original = async (x: number) => {
      invocation += 1;
      await delay(10); // simulate async IO
      return x * 2;
    };

    const cached = withCache(original, 5); // 5-second TTL

    const r1 = await cached(2);
    const r2 = await cached(2);

    expect(r1).toBe(4);
    expect(r2).toBe(4);
    expect(invocation).toBe(1); // underlying function called only once
  });

  it('persists to KV namespace when provided', async () => {
    // Simple in-memory KV mock
    const store = new Map<string, string>();
    const kv: any = {
      async get<T>(key: string, opts?: { type: 'json' }): Promise<T | null> {
        const raw = store.get(key);
        if (raw === undefined) return null;
        return JSON.parse(raw) as T;
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
    };

    let hits = 0;
    const refresher = async (val: number) => {
      hits += 1;
      return val + 1;
    };

    const cached = withCache(refresher, 60, kv);

    const first = await cached(3);
    const second = await cached(3);

    expect(first).toBe(4);
    expect(second).toBe(4);
    expect(hits).toBe(1);

    // Ensure raw KV entry exists
    const stored = await kv.get('refresher:[3]', { type: 'json' });
    expect(stored).toBe(4);
  });
});