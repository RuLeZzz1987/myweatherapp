/**
 * WeatherCache Durable Object — direct unit tests via the runtime helpers
 * exposed by `@cloudflare/vitest-pool-workers`. Each test gets a fresh DO
 * instance via `runInDurableObject` so cache state never leaks across cases.
 */

import { describe, expect, it } from 'vitest';
import { env, runInDurableObject } from 'cloudflare:test';

import { WeatherCache } from '../src/do/WeatherCache';

function getStub(name = `cache-${crypto.randomUUID()}`) {
  const id = env.WEATHER_CACHE.idFromName(name);
  return { id, stub: env.WEATHER_CACHE.get(id) };
}

async function callDo<T>(stub: DurableObjectStub, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = body
    ? { method: 'POST', body: JSON.stringify(body) }
    : { method: 'GET' };
  const res = await stub.fetch(`https://do${path}`, init);
  return (await res.json()) as T;
}

describe('WeatherCache', () => {
  it('returns hit:false for an unknown key', async () => {
    const { stub } = getStub();
    const got = await callDo<{ hit: boolean }>(stub, '/get', { key: 'missing' });
    expect(got.hit).toBe(false);
  });

  it('round-trips a payload within TTL', async () => {
    const { stub } = getStub();
    await callDo(stub, '/set', {
      key: 'wx:59.9100:10.7500:metric',
      payload: { city: 'Oslo', temp: 4 },
      ttlMs: 60_000,
    });
    const got = await callDo<{ hit: boolean; payload?: { city: string; temp: number } }>(
      stub,
      '/get',
      { key: 'wx:59.9100:10.7500:metric' },
    );
    expect(got.hit).toBe(true);
    expect(got.payload).toEqual({ city: 'Oslo', temp: 4 });
  });

  it('reports an expired entry as a miss but exposes the stale payload', async () => {
    const { id, stub } = getStub();
    await callDo(stub, '/set', { key: 'k', payload: { v: 1 }, ttlMs: 1 });

    // Force expiry by rewinding the row's expires_at directly through the SQL
    // surface. This avoids real wall-clock waits in tests.
    await runInDurableObject(stub, async (instance, state) => {
      void instance;
      state.storage.sql.exec(
        'UPDATE entries SET expires_at = ? WHERE key = ?',
        Date.now() - 60_000,
        'k',
      );
    });
    void id;

    const got = await callDo<{ hit: boolean; payload?: { v: number }; expired?: boolean }>(
      stub,
      '/get',
      { key: 'k' },
    );
    expect(got.hit).toBe(false);
    expect(got.expired).toBe(true);
    expect(got.payload).toEqual({ v: 1 });
  });

  it('purges entries by prefix', async () => {
    const { stub } = getStub();
    await callDo(stub, '/set', { key: 'geo:oslo:en', payload: ['a'], ttlMs: 60_000 });
    await callDo(stub, '/set', { key: 'geo:berlin:en', payload: ['b'], ttlMs: 60_000 });
    await callDo(stub, '/set', { key: 'wx:59:10:metric', payload: ['c'], ttlMs: 60_000 });

    await callDo(stub, '/purge', { prefix: 'geo:' });

    const sizeRes = await stub.fetch('https://do/size');
    const { rows } = (await sizeRes.json()) as { rows: number };
    expect(rows).toBe(1);
  });

  it('alarm GC sweeps expired rows', async () => {
    const { stub } = getStub();
    await callDo(stub, '/set', { key: 'fresh', payload: 1, ttlMs: 60_000 });
    await callDo(stub, '/set', { key: 'rotten', payload: 2, ttlMs: 60_000 });

    await runInDurableObject(stub, async (instance, state) => {
      state.storage.sql.exec(
        'UPDATE entries SET expires_at = ? WHERE key = ?',
        Date.now() - 60_000,
        'rotten',
      );
      await instance.alarm?.();
    });

    const sizeRes = await stub.fetch('https://do/size');
    const { rows } = (await sizeRes.json()) as { rows: number };
    expect(rows).toBe(1);
  });

  it('rejects malformed input', async () => {
    const { stub } = getStub();
    const setNoKey = await stub.fetch('https://do/set', {
      method: 'POST',
      body: JSON.stringify({ payload: 1, ttlMs: 1 }),
    });
    expect(setNoKey.status).toBe(400);

    const getNoKey = await stub.fetch('https://do/get', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(getNoKey.status).toBe(400);
  });

  // Touching the export keeps the symbol referenced from tests so an unused
  // import lint doesn't fire. The class itself is reached via env.WEATHER_CACHE.
  it('exports the DO class for the runtime', () => {
    expect(WeatherCache).toBeDefined();
  });
});
