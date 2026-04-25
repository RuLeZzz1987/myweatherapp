/**
 * WeatherCache Durable Object — direct unit tests via the runtime helpers
 * exposed by `@cloudflare/vitest-pool-workers`. Each test gets a fresh DO
 * instance via `runInDurableObject` so cache state never leaks across cases.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('/get-or-fetch coalescing', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;
    let upstreamCalls: number;
    let releaseGate: (() => void) | undefined;
    let upstreamGate: Promise<void> | undefined;

    beforeEach(() => {
      upstreamCalls = 0;
      upstreamGate = new Promise<void>((resolve) => {
        releaseGate = resolve;
      });
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        upstreamCalls += 1;
        // Hold every upstream call open until the test releases the gate;
        // this lets us prove that two in-flight /get-or-fetch invocations
        // share the same outbound fetch instead of fanning out.
        await upstreamGate;
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 99,
                name: 'Paris',
                latitude: 48.85,
                longitude: 2.35,
                country: 'France',
                country_code: 'FR',
                timezone: 'Europe/Paris',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });
    });

    afterEach(() => {
      releaseGate?.();
      fetchSpy?.mockRestore();
    });

    it('coalesces concurrent identical /get-or-fetch calls into one upstream hit', async () => {
      const { stub } = getStub();

      // Fire two concurrent /get-or-fetch calls with the same key. Both
      // must enter the DO before either's upstream promise resolves —
      // input gates allow that interleaving.
      const a = stub.fetch('https://do/get-or-fetch', {
        method: 'POST',
        body: JSON.stringify({
          key: 'geo:paris:fr:5',
          ttlMs: 60_000,
          kind: 'geocode',
          params: { q: 'Paris', limit: 5, language: 'fr' },
        }),
      });
      const b = stub.fetch('https://do/get-or-fetch', {
        method: 'POST',
        body: JSON.stringify({
          key: 'geo:paris:fr:5',
          ttlMs: 60_000,
          kind: 'geocode',
          params: { q: 'Paris', limit: 5, language: 'fr' },
        }),
      });

      // Microtask drain so both requests are sitting in the DO before we
      // let upstream resolve.
      await new Promise((r) => setTimeout(r, 0));
      releaseGate?.();

      const [resA, resB] = await Promise.all([a, b]);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(upstreamCalls).toBe(1);

      const bodyA = (await resA.json()) as {
        state: string;
        payload: { results: Array<{ name: string }> };
      };
      const bodyB = (await resB.json()) as {
        state: string;
        payload: { results: Array<{ name: string }> };
      };
      expect(bodyA.state).toBe('upstream');
      // The second caller might be observed as `upstream` (joined the in-
      // flight) or as `cache` (arrived after the row was committed) — both
      // are correct outcomes; what matters is that no second upstream call
      // happened.
      expect(['upstream', 'cache']).toContain(bodyB.state);
      expect(bodyB.payload.results[0]?.name).toBe('Paris');
    });

    it('returns state:cache on subsequent calls within TTL', async () => {
      const { stub } = getStub();

      releaseGate?.();
      const first = await stub.fetch('https://do/get-or-fetch', {
        method: 'POST',
        body: JSON.stringify({
          key: 'geo:london:en:5',
          ttlMs: 60_000,
          kind: 'geocode',
          params: { q: 'London', limit: 5, language: 'en' },
        }),
      });
      expect(((await first.json()) as { state: string }).state).toBe('upstream');
      expect(upstreamCalls).toBe(1);

      const second = await stub.fetch('https://do/get-or-fetch', {
        method: 'POST',
        body: JSON.stringify({
          key: 'geo:london:en:5',
          ttlMs: 60_000,
          kind: 'geocode',
          params: { q: 'London', limit: 5, language: 'en' },
        }),
      });
      expect(((await second.json()) as { state: string }).state).toBe('cache');
      expect(upstreamCalls).toBe(1);
    });

    it('returns state:error with no cache and upstream failure', async () => {
      // Replace the mock to fail upstream.
      fetchSpy?.mockRestore();
      fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => new Response('', { status: 503 }));

      const { stub } = getStub();
      const res = await stub.fetch('https://do/get-or-fetch', {
        method: 'POST',
        body: JSON.stringify({
          key: 'geo:nowhere:en:5',
          ttlMs: 60_000,
          kind: 'geocode',
          params: { q: 'Nowhereville', limit: 5, language: 'en' },
        }),
      });
      const body = (await res.json()) as { state: string; status?: number };
      expect(body.state).toBe('error');
      expect(body.status).toBe(502);
    });
  });
});
