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
});