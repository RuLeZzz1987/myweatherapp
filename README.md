# MyWeather

A personalized weather app: search for a city, see the current conditions and the week ahead, switch units and language, and have your last few searches kept around for one click. Built as a take-home for a front-end role.

**Live demo: [https://myweather.aveing.workers.dev](https://myweather.aveing.workers.dev)**

Deep-link example: [`/?id=5128581&lat=40.7143&lon=-74.0060&name=New+York&country=United+States&cc=US&lang=de`](https://myweather.aveing.workers.dev/?id=5128581&lat=40.7143&lon=-74.0060&name=New+York&country=United+States&cc=US&lang=de)

Weather data by [Open-Meteo](https://open-meteo.com), free for non-commercial use under CC-BY 4.0.

---

## Tech stack at a glance

| Layer        | Choice                                                                      |
| ------------ | --------------------------------------------------------------------------- |
| Runtime      | Cloudflare Worker (single Worker hosts SPA + `/api/*`)                      |
| Build        | Vite 8, pnpm workspaces, TypeScript (strict)                                |
| UI           | React 19, Tailwind CSS v4, custom inline-SVG weather illustrations          |
| Server state | TanStack Query                                                              |
| UI prefs     | Zustand (units + language override, persisted to `localStorage`)            |
| Routing      | URL is the source of truth via `useUrlSelection` (no client router needed)  |
| Backend      | Hono on the Worker, Zod for input validation                                |
| Cache        | Cloudflare Durable Object (`WeatherCache`) on the SQLite storage backend    |
| Upstream     | Open-Meteo forecast + geocoding (no API key, no signup)                     |
| i18n         | `react-i18next` + `Intl.*` formatters, 12 EU locales, CLDR plural rules     |
| Testing      | Vitest + React Testing Library + `user-event` + MSW + `vitest-pool-workers` |
| Quality gate | ESLint, Prettier, i18n catalog parity check, 80% statement coverage on web  |
| Crash safety | `@sentry/react` ErrorBoundary at the tree root + QueryCache 5xx reporter    |
| CI/CD        | GitHub Actions: verify → deploy on push to `main`                           |

---

## Repo layout

```
.
├── apps/
│   ├── web/                # Vite + React SPA (@myweather/web)
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/         # AppHeader, SearchBar, CurrentWeatherHero,
│   │   │   │                       # HourlyForecast, DailyForecast, SecondaryStats,
│   │   │   │                       # RecentSearches, ErrorState, OfflineBanner, …
│   │   │   ├── hooks/              # useWeather, useGeocode, useUrlSelection,
│   │   │   │                       # useOnlineStatus, useDebouncedValue
│   │   │   ├── i18n/               # i18next config + format helpers + 12 catalogs
│   │   │   └── store/              # Zustand prefs store
│   │   └── scripts/i18n-check.mjs  # CI gate: catalog parity + plural completeness
│   └── api/                # Cloudflare Worker (@myweather/api)
│       └── src/
│           ├── index.ts            # Hono app, security headers, error sanitization
│           ├── routes/             # /api/weather, /api/geocode, /api/health
│           ├── upstream/openMeteo  # typed wrappers around Open-Meteo
│           └── do/WeatherCache.ts  # Durable Object: cache + GC alarm + coalescing
├── packages/
│   └── contracts/          # @myweather/contracts — wire types shared by web ↔ api
├── SPEC.md                 # internal design doc (decisions, trade-offs, history)
├── requirements.md         # original take-home brief
└── wireframe.png           # the supplied design sketch
```

---

## Quick start

Prerequisites: Node 22+, pnpm 10+ (the repo pins both via `.nvmrc` and `packageManager`).

```bash
pnpm install
pnpm dev
```

This runs the SPA on [http://localhost:5173](http://localhost:5173) and Wrangler's local Worker on `http://127.0.0.1:8787`. Vite proxies `/api/*` to the Worker, so the dev URL behaves exactly like production.

### Other scripts

```bash
pnpm test            # unit + integration tests across all packages
pnpm typecheck       # strict tsc for every package
pnpm lint            # ESLint with typescript-eslint + react-hooks + jsx-a11y
pnpm format:check    # Prettier (use `pnpm format` to fix)
pnpm i18n:check      # locale catalog parity + plural completeness gate
pnpm build           # builds web SPA + dry-run worker bundle
```

The web package additionally exposes `test:watch` and `test:coverage`. The 80% statement-coverage threshold for `apps/web/src` is enforced in CI.

---

## Local Cloudflare setup (only needed if you redeploy)

The deployed instance is already wired up; you don't need an account just to read this code. To run **your own** copy:

1. Sign up for Cloudflare (free tier is enough — Workers Free includes Durable Objects on the SQLite backend).
2. `cp .env.example .env` and fill in `CLOUDFLARE_ACCOUNT_ID` plus an API token scoped to **Workers Scripts: Edit + Account: Read**.
3. `pnpm --filter @myweather/api run deploy`.

CI uses the same two values as repo secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) and deploys on every push to `main`.

---

## How the requirements map to the code

| Requirement                            | Where                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Vite + pnpm                            | `pnpm-workspace.yaml`, `apps/web/vite.config.ts`                                                        |
| React frontend                         | `apps/web/src/**`                                                                                       |
| Weather API integration                | `apps/api/src/upstream/openMeteo.ts` (Open-Meteo forecast + geocoding, no key)                          |
| Cloudflare Durable Objects for caching | `apps/api/src/do/WeatherCache.ts` — SQLite-backed DO, 10 min weather TTL, 24 h geocode TTL, hourly GC   |
| Responsiveness                         | Tailwind responsive utilities throughout the hero, hourly/daily strips, stats grid, and recent searches |
| Public test URL                        | [https://myweather.aveing.workers.dev](https://myweather.aveing.workers.dev) (single Worker, no CORS)   |
| Unit and integration specs             | 220 tests across `apps/web/src/**/__tests__` and `apps/api/src` (run with `pnpm test`)                  |

---

## Design choices worth highlighting

**Single Worker, single URL.** The SPA and `/api/*` ship as one Cloudflare Worker. Same origin, no CORS, one deploy command. The SPA is served as Static Assets bound to the Worker; routes that don't match an asset fall through to the Hono app.

**URL is the source of truth.** Selected city, units, and language all live in the query string. `useUrlSelection` is the only thing that reads/writes URL state, so deep links (and "share this forecast") work out of the box and back/forward navigation does the right thing. There's no client-side router because there's no second route — adding React Router would be pure dependency weight.

**Durable Object cache with request coalescing.** The `WeatherCache` DO uses the SQLite storage backend (the only DO storage available on the free tier). It exposes a `/get-or-fetch` endpoint that holds a per-key in-memory `inflight` map: if 50 tabs hit the same city in the same TTL window, only one upstream call goes out. An hourly alarm sweeps expired rows.

**Open-Meteo as the only upstream.** No API key, no signup, no fallback to a paid provider. The app surfaces only fields the free tier returns. Attribution is in the footer per CC-BY 4.0.

**i18n done properly.** 12 EU locales (en, nb, de, fr, es, it, nl, pl, pt, sv, da, fi). English is the source/default. The active locale is resolved as URL `?lang=` → `localStorage` → `navigator.languages` → `en`. Plurals follow CLDR (`_one`, `_few`, `_many`, `_other`). All number/date/relative-time/region formatting goes through native `Intl.*`. A `pnpm i18n:check` script enforces catalog parity and plural completeness in CI.

**Accessibility taken seriously.** WAI-ARIA combobox for the search field with keyboard navigation, `aria-live` regions for async status, dynamic `<html lang>` synced to the active locale, semantic landmarks, and a skip-to-main-content link. `jsx-a11y` lints in CI.

**States the wireframe didn't show.** Empty / loading skeleton / not-found / generic error / offline (with `navigator.onLine` + listeners). These are tested explicitly.

**Server-side hardening.** Baseline security headers via Hono middleware (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). Public 5xx responses are sanitized so upstream `err.message` strings never leak; the full error is still logged server-side.

**Bundler hygiene.** `vite.config.ts` dedupes `i18next` and `react-i18next` so the singleton stays a singleton — without this, Vite's dep optimizer can pre-bundle two copies and `useTranslation()` ends up reading from a different instance than the one we configure.

**Crash safety net.** A top-level `<AppErrorBoundary>` wraps the tree in `main.tsx`. If anything render-time throws (a malformed cached payload, an `Intl.*` rejection, a missing i18n key during a rollout) the user sees a localized "Something went wrong / Reload" panel instead of a white screen. The boundary forwards the error to Sentry via `@sentry/react` when `VITE_SENTRY_DSN` is set, otherwise it stays a pure-client fallback. TanStack Query failures with HTTP 5xx are also reported (4xx and aborts are filtered out — they're user/input issues, not bugs).

---

## Things I deliberately did not build

These are documented and justified in `SPEC.md` rather than left silent:

- **No client-side router.** One screen, one query-string contract. Skip is intentional; revisit if a 2nd route ever lands.
- **No CSP.** Conflicts with Vite's inline styles + module preloads in this scope; not worth the workaround for a free-tier portfolio piece. Other security headers are still set.
- **No E2E rig.** Vitest + RTL + MSW + the Cloudflare workers test pool already cover the integration boundary, including DO behavior. A Playwright layer wasn't justified here.
- **No RTL layout.** No RTL languages in the supported EU set. Listed as future work.
- **No translated geocoding results.** Open-Meteo returns place names in the locale of the request. We display them as the API returns them rather than re-translating.
- **No premium weather fields.** Strictly free-tier Open-Meteo. If a field isn't returned, we don't show it.

---

## What I'd add next

- Geolocation prompt for "use my current location" on first visit.
- Service worker so the last successful forecast is viewable offline (the offline banner is in place; the cache layer is the missing half).
- Air-quality / pollen overlays — would require a second provider (probably keyed) and was scoped out for the take-home.
- E2E smoke against the deployed URL via Playwright in CI.
