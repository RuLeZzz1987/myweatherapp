/**
 * WeatherCache — Durable Object backing the API's caching layer.
 *
 * - SQLite storage backend (free-tier requirement; declared via
 *   `new_sqlite_classes` in wrangler.toml).
 * - Single shared instance per Worker, addressed by `idFromName('cache')`.
 * - Internal HTTP-shaped API (callers `fetch()` the DO stub):
 *     POST /get               { key }                          → { hit, payload?, expired? }
 *     POST /set               { key, payload, ttlMs }          → { ok: true }
 *     POST /purge             { prefix }                       → { ok: true }
 *     POST /get-or-fetch      { key, ttlMs, kind, params }     → CoalesceResult
 *     GET  /size                                                → { rows }   (debug/test)
 * - Hourly alarm garbage-collects expired rows so the DO doesn't grow
 *   unboundedly under high cardinality (every unique lat/lon pair becomes
 *   its own row).
 *
 * ### In-DO request coalescing (`/get-or-fetch`)
 *
 * Open-Meteo's free-tier rate limits and our own 10-minute weather TTL make
 * concurrent identical requests wasteful. A single DO instance is the
 * natural place to dedupe them: every request to the API ends up on the
 * same DO ({@link getCache} pins it via `idFromName('cache')`), and the DO
 * runtime guarantees one logical thread per instance, so a plain JS `Map`
 * is enough — no locking needed.
 *
 * Algorithm per `/get-or-fetch` call:
 *
 *   1. Fresh cache row? → return `{ state: 'cache', payload }`.
 *   2. Already in-flight for this key? → `await` the existing promise and
 *      forward its result. All concurrent callers see the same outcome.
 *   3. Otherwise: register a new in-flight promise that calls upstream,
 *      writes the result into SQLite on success, and on failure either
 *      falls back to the (now-expired) row as `{ state: 'stale' }` or
 *      surfaces `{ state: 'error', status }` for the route to translate.
 *      The promise is removed from the map on settle.
 *
 * Storing the upstream call inside the DO (rather than in routes/) is
 * deliberate: only here do we have the single-instance guarantee that lets
 * us coalesce safely without a distributed lock. See SPEC.md §4.2.
 *
 * See SPEC.md §4.2 for the full contract; the routes layer treats this DO
 * as an opaque cache and never reaches into its SQL.
 */

import type { Env, GeocodeResult, Units, WeatherResponse } from '../types';
import { UpstreamError, forecast, geocode } from '../upstream/openMeteo';

const GC_INTERVAL_MS = 60 * 60 * 1_000;

interface GetResponse<T> {
  hit: boolean;
  /** The cached payload — only present when `hit` is true. */
  payload?: T;
  /** Set when the row exists but is past `expires_at` (caller may opt to use as stale). */
  expired?: boolean;
}

type CacheRow = {
  payload: string;
  expires_at: number;
} & Record<string, SqlStorageValue>;

// ---------------------------------------------------------------------------
// Coalesce protocol — `POST /get-or-fetch`
// ---------------------------------------------------------------------------

export type CoalesceKind = 'weather' | 'geocode';

interface WeatherUpstreamParams {
  lat: number;
  lon: number;
  units: Units;
  name: string;
  country: string;
}

interface GeocodeUpstreamParams {
  q: string;
  limit: number;
  language?: string;
}

interface CoalesceRequest {
  key: string;
  ttlMs: number;
  kind: CoalesceKind;
  /** Discriminated by `kind`; the DO type-asserts before use. */
  params: WeatherUpstreamParams | GeocodeUpstreamParams;
}

export type CoalesceResult<T = unknown> =
  | { state: 'cache'; payload: T }
  | { state: 'upstream'; payload: T }
  | { state: 'stale'; payload: T }
  | { state: 'error'; status: 502 | 504 };

export class WeatherCache implements DurableObject {
  private readonly state: DurableObjectState;
  private initialized = false;

  /**
   * Per-DO map of in-flight upstream calls keyed by cache key. Lives only
   * for the DO instance lifetime — that's sufficient since the DO routes
   * every concurrent caller to the same instance. See class JSDoc.
   */
  private readonly inflight = new Map<string, Promise<CoalesceResult>>();

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInit();

    const url = new URL(request.url);
    try {
      switch (url.pathname) {
        case '/get':
          return await this.handleGet(request);
        case '/set':
          return await this.handleSet(request);
        case '/purge':
          return await this.handlePurge(request);
        case '/get-or-fetch':
          return await this.handleGetOrFetch(request);
        case '/size':
          return await this.handleSize();
        default:
          return Response.json({ error: 'not_found' }, { status: 404 });
      }
    } catch (err) {
      // Log the underlying error for ops/tail; never echo `err.message`
      // back through the DO boundary — it can carry SQL fragments, stack
      // frame names, or storage-layer detail. Routes layer treats any
      // non-OK from the DO as a cache miss anyway (see `getCache`).
      console.error('WeatherCache error:', err);
      return Response.json({ error: 'cache_error' }, { status: 500 });
    }
  }

  /** Hourly GC of expired rows. */
  async alarm(): Promise<void> {
    await this.ensureInit();
    const sql = this.state.storage.sql;
    sql.exec('DELETE FROM entries WHERE expires_at < ?', Date.now());
    await this.scheduleNextAlarm();
  }

  // ---------------- handlers

  private async handleGet(request: Request): Promise<Response> {
    const { key } = await this.readJson<{ key: string }>(request);
    if (!key) return Response.json({ error: 'missing_key' }, { status: 400 });

    const row = this.readRow(key);
    if (!row) {
      return Response.json({ hit: false } satisfies GetResponse<unknown>);
    }

    const expired = row.expires_at < Date.now();
    const payload = JSON.parse(row.payload) as unknown;

    return Response.json({ hit: !expired, payload, expired } satisfies GetResponse<unknown>);
  }

  private async handleSet(request: Request): Promise<Response> {
    const body = await this.readJson<{ key?: unknown; payload?: unknown; ttlMs?: unknown }>(
      request,
    );
    if (typeof body.key !== 'string' || !body.key) {
      return Response.json({ error: 'missing_key' }, { status: 400 });
    }
    if (typeof body.ttlMs !== 'number' || body.ttlMs <= 0) {
      return Response.json({ error: 'invalid_ttl' }, { status: 400 });
    }
    if (body.payload === undefined) {
      return Response.json({ error: 'missing_payload' }, { status: 400 });
    }

    this.writeRow(body.key, body.payload, Date.now() + body.ttlMs);
    await this.scheduleNextAlarm();
    return Response.json({ ok: true });
  }

  private async handlePurge(request: Request): Promise<Response> {
    const { prefix } = await this.readJson<{ prefix?: string }>(request);
    const sql = this.state.storage.sql;

    if (typeof prefix === 'string' && prefix.length > 0) {
      // Internal-only endpoint; the only callers in this repo pass
      // literal prefixes like `wx:` or `geo:` that don't contain LIKE
      // metacharacters (`%`, `_`). The `?` parameter binding prevents
      // SQL injection regardless. If we ever expose this externally
      // we'd need to escape LIKE wildcards explicitly.
      sql.exec('DELETE FROM entries WHERE key LIKE ?', `${prefix}%`);
    } else {
      sql.exec('DELETE FROM entries');
    }
    return Response.json({ ok: true });
  }

  private async handleSize(): Promise<Response> {
    const sql = this.state.storage.sql;
    const row = sql
      .exec<
        { rows: number } & Record<string, SqlStorageValue>
      >('SELECT COUNT(*) AS rows FROM entries')
      .toArray()[0];
    return Response.json({ rows: row?.rows ?? 0 });
  }

  /**
   * Coalescing core. Concurrent identical keys join the same in-flight
   * upstream promise; see class JSDoc for the full algorithm + rationale.
   */
  private async handleGetOrFetch(request: Request): Promise<Response> {
    const body = await this.readJson<CoalesceRequest>(request);
    if (typeof body.key !== 'string' || !body.key) {
      return Response.json({ error: 'missing_key' }, { status: 400 });
    }
    if (typeof body.ttlMs !== 'number' || body.ttlMs <= 0) {
      return Response.json({ error: 'invalid_ttl' }, { status: 400 });
    }
    if (body.kind !== 'weather' && body.kind !== 'geocode') {
      return Response.json({ error: 'invalid_kind' }, { status: 400 });
    }

    // Step 1 — fresh hit?
    const row = this.readRow(body.key);
    if (row && row.expires_at >= Date.now()) {
      const payload = JSON.parse(row.payload) as unknown;
      return Response.json({ state: 'cache', payload } satisfies CoalesceResult);
    }

    // Step 2 — join an existing flight if any. Subsequent callers see
    // whatever the originator resolved with (upstream/stale/error), so we
    // never make redundant outbound calls under burst load.
    const existing = this.inflight.get(body.key);
    if (existing) {
      const result = await existing;
      return Response.json(result);
    }

    // Step 3 — kick off a new flight, register it, await, return.
    const stalePayload = row ? (JSON.parse(row.payload) as unknown) : undefined;
    const flight = this.runUpstream(body, stalePayload).finally(() => {
      this.inflight.delete(body.key);
    });
    this.inflight.set(body.key, flight);

    const result = await flight;
    return Response.json(result);
  }

  // ---------------- internals

  /** Single source of truth for upstream calls. */
  private async runUpstream(req: CoalesceRequest, stalePayload: unknown): Promise<CoalesceResult> {
    try {
      const payload =
        req.kind === 'weather'
          ? await this.upstreamForecast(req.params as WeatherUpstreamParams)
          : await this.upstreamGeocode(req.params as GeocodeUpstreamParams);

      this.writeRow(req.key, payload, Date.now() + req.ttlMs);
      await this.scheduleNextAlarm();
      return { state: 'upstream', payload };
    } catch (err) {
      if (stalePayload !== undefined) {
        return { state: 'stale', payload: stalePayload };
      }
      if (err instanceof UpstreamError) {
        const status = err.status === 504 ? 504 : 502;
        return { state: 'error', status };
      }
      // Unknown error — log so it shows up in the tail; surface as 502.
      console.error('WeatherCache.runUpstream error:', err);
      return { state: 'error', status: 502 };
    }
  }

  private async upstreamForecast(params: WeatherUpstreamParams): Promise<WeatherResponse> {
    const fresh = await forecast(params.lat, params.lon, params.name, params.country, {
      units: params.units,
    });
    return {
      ...fresh,
      fetchedAt: new Date().toISOString(),
      source: 'upstream',
    };
  }

  private async upstreamGeocode(
    params: GeocodeUpstreamParams,
  ): Promise<{ results: GeocodeResult[]; cachedAt: string }> {
    const results = await geocode(params.q, {
      ...(params.language !== undefined ? { language: params.language } : {}),
      limit: params.limit,
    });
    return { results, cachedAt: new Date().toISOString() };
  }

  private readRow(key: string): CacheRow | undefined {
    const sql = this.state.storage.sql;
    return sql
      .exec<CacheRow>('SELECT payload, expires_at FROM entries WHERE key = ?', key)
      .toArray()[0];
  }

  private writeRow(key: string, payload: unknown, expiresAt: number): void {
    const sql = this.state.storage.sql;
    sql.exec(
      `INSERT INTO entries (key, payload, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           payload = excluded.payload,
           expires_at = excluded.expires_at`,
      key,
      JSON.stringify(payload),
      expiresAt,
    );
  }

  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    this.state.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS entries (
         key TEXT PRIMARY KEY,
         payload TEXT NOT NULL,
         expires_at INTEGER NOT NULL
       )`,
    );
    this.state.storage.sql.exec(
      'CREATE INDEX IF NOT EXISTS entries_expires_at ON entries (expires_at)',
    );
    this.initialized = true;
  }

  private async scheduleNextAlarm(): Promise<void> {
    const existing = await this.state.storage.getAlarm();
    if (existing !== null) return;
    await this.state.storage.setAlarm(Date.now() + GC_INTERVAL_MS);
  }

  private async readJson<T>(request: Request): Promise<T> {
    try {
      return (await request.json()) as T;
    } catch {
      throw new Error('invalid_json');
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers callable from route handlers — typed wrappers around the HTTP-shaped
// internal API. Keeps the routes layer free of `Response.json()` boilerplate
// for cache I/O.
// ---------------------------------------------------------------------------

export interface CacheClient {
  get<T>(key: string): Promise<{ hit: boolean; payload?: T; expired?: boolean }>;
  set<T>(key: string, payload: T, ttlMs: number): Promise<void>;
  /**
   * Atomic "cache-or-upstream" with in-DO request coalescing. See class
   * JSDoc on {@link WeatherCache} for the full contract; routes treat the
   * returned discriminated union as the only state worth pattern-matching.
   */
  getOrFetch<T>(req: CoalesceRequest): Promise<CoalesceResult<T>>;
}

export function getCache(env: Env, name = 'cache'): CacheClient {
  const id = env.WEATHER_CACHE.idFromName(name);
  const stub = env.WEATHER_CACHE.get(id);

  return {
    async get<T>(key: string) {
      const res = await stub.fetch('https://do/get', {
        method: 'POST',
        body: JSON.stringify({ key }),
      });
      if (!res.ok) return { hit: false };
      return (await res.json()) as { hit: boolean; payload?: T; expired?: boolean };
    },
    async set<T>(key: string, payload: T, ttlMs: number) {
      await stub.fetch('https://do/set', {
        method: 'POST',
        body: JSON.stringify({ key, payload, ttlMs }),
      });
    },
    async getOrFetch<T>(req: CoalesceRequest): Promise<CoalesceResult<T>> {
      const res = await stub.fetch('https://do/get-or-fetch', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      // The DO never returns non-OK on a well-formed call (errors are
      // baked into `state: 'error'`), but if it does treat it as upstream
      // failure with no fallback so the route surfaces a clean 502.
      if (!res.ok) {
        return { state: 'error', status: 502 } as CoalesceResult<T>;
      }
      return (await res.json()) as CoalesceResult<T>;
    },
  };
}
