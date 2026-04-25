/**
 * WeatherCache — Durable Object backing the API's caching layer.
 *
 * - SQLite storage backend (free-tier requirement; declared via
 *   `new_sqlite_classes` in wrangler.toml).
 * - Single shared instance per Worker, addressed by `idFromName('cache')`.
 * - Internal HTTP-shaped API (callers `fetch()` the DO stub):
 *     POST /get   { key }                  → { hit, payload?, expiredAt? }
 *     POST /set   { key, payload, ttlMs }  → { ok: true }
 *     POST /purge { prefix }               → { ok: true, deleted }
 *     GET  /size                            → { rows }    (debug/test)
 * - Hourly alarm garbage-collects expired rows so the DO doesn't grow
 *   unboundedly under high cardinality (every unique lat/lon pair becomes
 *   its own row).
 *
 * See SPEC.md §4.2 for the full contract; the routes layer treats this DO
 * as an opaque cache and never reaches into its SQL.
 */

import type { Env } from '../types';

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

export class WeatherCache implements DurableObject {
  private readonly state: DurableObjectState;
  private initialized = false;

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
        case '/size':
          return await this.handleSize();
        default:
          return Response.json({ error: 'not_found' }, { status: 404 });
      }
    } catch (err) {
      return Response.json(
        { error: 'cache_error', message: (err as Error).message },
        { status: 500 },
      );
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

    const sql = this.state.storage.sql;
    const row = sql
      .exec<CacheRow>('SELECT payload, expires_at FROM entries WHERE key = ?', key)
      .toArray()[0];

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

    const expiresAt = Date.now() + body.ttlMs;
    const sql = this.state.storage.sql;
    sql.exec(
      `INSERT INTO entries (key, payload, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           payload = excluded.payload,
           expires_at = excluded.expires_at`,
      body.key,
      JSON.stringify(body.payload),
      expiresAt,
    );

    await this.scheduleNextAlarm();
    return Response.json({ ok: true });
  }

  private async handlePurge(request: Request): Promise<Response> {
    const { prefix } = await this.readJson<{ prefix?: string }>(request);
    const sql = this.state.storage.sql;

    if (typeof prefix === 'string' && prefix.length > 0) {
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

  // ---------------- internals

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
  };
}
