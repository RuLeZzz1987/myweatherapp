# MyWeather — Weather App Spec

> Executable spec for the front-end take-home. Each section is scoped so the agent can pick it up and implement it in order. Defaults are chosen to favor a small, modern, well-tested codebase that visibly hits every grading criterion in the requirements.

---

## 0. Open questions (resolve before / during implementation)

- Need a Cloudflare account (free tier sufficient — see §0.1). If unavailable, we deliver a runnable repo and a recorded screencap.
- App is fully internationalized. **English is the source/default locale**; the active locale is auto-detected from the browser (`navigator.languages`) and can be overridden by the user. The wireframe screenshot uses Norwegian copy — that's just one of the supported locales (`nb-NO`), not the default. The brand wordmark "MyWeather" stays as a non-translated proper noun. See §5.8 for the full i18n/l10n design and supported locales.

## 0.1 Decisions (locked in)

- **Upstream data is free + no-registration only.** We commit to **Open-Meteo** (forecast) and **Open-Meteo Geocoding** because they require no API key and no signup. We will only surface fields these endpoints expose on the free tier; nothing premium, no fallback to a keyed provider. If a field isn't returned, we don't show it.
- **Licensing / attribution.** Open-Meteo data is CC-BY 4.0 and free for non-commercial use. The footer (and the README) will include `Weather data by Open-Meteo.com` with a link, satisfying the attribution requirement. This take-home is a portfolio piece, so non-commercial terms are fine; the README documents the upgrade path (paid plan key wired through an env var) for a hypothetical commercial deployment.
- **No third-party data beyond Open-Meteo.** No air-quality / pollen / radar overlays in v1, since each would require a different (often keyed) provider. Listed in README as future work.
- **Deployment: Cloudflare Workers with Static Assets, single Worker (Option A).** The SPA build (`apps/web/dist`) and the `/api/*` routes ship as one Worker bound to the `WeatherCache` Durable Object, on a single URL like `https://myweather.<account>.workers.dev`. No separate Pages project, no CORS, one deploy command.
- **Cloudflare free tier is sufficient.** As of April 2025 Durable Objects are on Workers Free (100k req/day, 13k GB-s/day compute, 5 GB storage account-wide, SQLite storage backend only). The take-home will run at $0/mo. The DO **must use the SQLite storage backend** — declared via `new_sqlite_classes` in `wrangler.toml` migrations and `state.storage.sql` in the DO. Legacy KV-backed DOs are paid-only and we do not use them.
- **CI/CD: GitHub Actions on push to `main`** runs typecheck/lint/test/build, then `wrangler deploy`. Secrets: `CLOUDFLARE_API_TOKEN` (custom token scoped to Workers Scripts: Edit + Account: Read), `CLOUDFLARE_ACCOUNT_ID`. The deploy URL is published in the workflow summary and the README.

---

## 1. Goals & non-goals

### Product

- App brand **"MyWeather"** (English wordmark; the wireframe shows the original Norwegian "MinVærApp" but we ship the English brand consistently across all locales).
- Primary surface matches the wireframe layout: brand top-left, search top-right, big centered hero (city + huge temp + large weather illustration), recent-cities strip ("Recent searches" / "Siste søk" / "Letzte Suchen" / …) along the bottom.
- Fully **internationalized and localized**: English source strings, with EU-language packs auto-selected from the browser locale (see §5.8). Numbers, temperatures, dates, times, weekdays and country names are formatted via `Intl.*` per locale.
- Elevations beyond the wireframe (intentional, called out as "missing-in-design" in the README): hourly + daily forecast appear _below the fold_ as an expandable section, plus inline secondary stats (feels-like, wind, humidity, sunrise/sunset). This addresses the grading criterion _"Ability to spot and add important elements/states missing in design"_.

### Engineering goals

- Cache weather lookups in a Cloudflare **Durable Object** so repeat lookups (same city, within TTL) skip the upstream API.
- Be deployable to a public test URL on Cloudflare.
- Demonstrate code quality: typed, tested, modular, accessible, internationalized, sensible state management.

### Non-goals

- User accounts / auth.
- Persistent multi-user history (beyond per-browser localStorage).
- Native mobile apps.
- RTL layout work (no RTL languages in the EU locale set; left as a documented future task).
- Translation of place names returned by the geocoding API (we display them as the API returns them).

---

## 2. Tech stack

| Concern                | Choice                                                                                                                                                 | Why                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager        | **pnpm**                                                                                                                                               | Required by brief                                                                                                                           |
| Build tool             | **Vite**                                                                                                                                               | Required by brief                                                                                                                           |
| Language               | **TypeScript** (strict)                                                                                                                                | Type safety, better DX                                                                                                                      |
| UI framework           | **React 18+**                                                                                                                                          | Required                                                                                                                                    |
| Styling                | **Tailwind CSS v4** + CSS variables for theming                                                                                                        | Fast, responsive, design-token friendly                                                                                                     |
| State                  | React local state + **TanStack Query** (server cache) + small Zustand store for UI prefs                                                               | Right tool per concern; avoids Redux overkill                                                                                               |
| Routing                | **React Router** (single `/` route + deep-link `/?q=Berlin&lang=de`)                                                                                   | Lightweight                                                                                                                                 |
| i18n / l10n            | **`react-i18next`** + **`i18next-browser-languagedetector`** + native `Intl.*` (NumberFormat, DateTimeFormat, RelativeTimeFormat, DisplayNames)        | Mature, lazy-loadable JSON catalogs, plurals/ICU, low bundle cost. `Intl.*` covers number/date/relative-time formatting without extra deps. |
| Backend                | **Cloudflare Worker** (Hono) with **Durable Object** (`WeatherCache`)                                                                                  | Required by brief                                                                                                                           |
| Weather data           | **Open-Meteo** forecast API (free, no registration)                                                                                                    | Locked in; only displays fields free tier returns. CC-BY 4.0 attribution in footer.                                                         |
| Geocoding              | **Open-Meteo Geocoding** API (free, no registration)                                                                                                   | Same family, same terms                                                                                                                     |
| Charts                 | **Recharts** or `visx` (pick Recharts; smaller learning surface)                                                                                       | Hourly forecast viz                                                                                                                         |
| Icons / weather glyphs | **lucide-react** + custom SVG weather icons mapped from WMO codes                                                                                      | Crisp, accessible                                                                                                                           |
| Testing                | **Vitest** + **React Testing Library** + **@testing-library/user-event** + **MSW** + **Playwright** (one smoke E2E)                                    | Unit + integration + light E2E                                                                                                              |
| Lint / format          | **ESLint** (typescript-eslint, react-hooks, jsx-a11y) + **Prettier**                                                                                   | Required for code quality criterion                                                                                                         |
| CI                     | GitHub Actions: install → typecheck → lint → test → build                                                                                              | Catches regressions                                                                                                                         |
| Deploy                 | **Single Cloudflare Worker** with Static Assets serving the SPA build and `/api/*` routes, bound to the `WeatherCache` Durable Object (SQLite backend) | Free tier, one URL, no CORS, one deploy command (see §0.1, §8)                                                                              |

---

## 3. Repo layout

```
Hack/Staffer/
├── README.md                      # how to run, test, deploy
├── requirements.md                # original brief (do not edit)
├── SPEC.md                        # this file
├── wireframe.png                  # if/when provided
├── package.json                   # pnpm workspaces root
├── pnpm-workspace.yaml
├── .editorconfig
├── .prettierrc
├── eslint.config.js
├── tsconfig.base.json
├── .github/workflows/ci.yml
└── apps/
    ├── web/                       # Vite + React frontend
    │   ├── index.html
    │   ├── vite.config.ts
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── main.tsx
    │   │   ├── App.tsx
    │   │   ├── router.tsx
    │   │   ├── api/
    │   │   │   ├── client.ts       # fetch wrapper, types
    │   │   │   └── weather.ts      # query hooks (useWeather, useGeocode)
    │   │   ├── components/
    │   │   │   ├── AppHeader.tsx          # brand (top-left) + SearchBar (top-right)
    │   │   │   ├── SearchBar.tsx          # combobox w/ typeahead
    │   │   │   ├── CurrentWeatherHero.tsx # centered city + big temp + illustration
    │   │   │   ├── WeatherIllustration.tsx# large stylized SVG keyed by WMO code
    │   │   │   ├── RecentSearches.tsx     # "Siste søk" row of city cards
    │   │   │   ├── RecentSearchCard.tsx
    │   │   │   ├── HourlyForecast.tsx     # elevation, below the fold
    │   │   │   ├── DailyForecast.tsx      # elevation, below the fold
    │   │   │   ├── SecondaryStats.tsx     # feels-like, wind, humidity, sun
    │   │   │   ├── WeatherIcon.tsx        # small icon variant for cards
    │   │   │   ├── ErrorState.tsx
    │   │   │   ├── EmptyState.tsx
    │   │   │   ├── Skeleton.tsx
    │   │   │   ├── ThemeBackdrop.tsx
    │   │   │   └── AttributionFooter.tsx   # CC-BY 4.0 credit to Open-Meteo
    │   │   ├── hooks/
    │   │   │   ├── useDebouncedValue.ts
    │   │   │   ├── useGeolocation.ts
    │   │   │   ├── useRecentSearches.ts
    │   │   │   └── usePrefersReducedMotion.ts
    │   │   ├── i18n/
    │   │   │   ├── index.ts                # i18next init, language detection, lazy loader
    │   │   │   ├── supportedLocales.ts     # canonical list + display names + units defaults
    │   │   │   ├── format.ts               # Intl-based formatters (temp, date, relative time, list, displayName)
    │   │   │   └── locales/
    │   │   │       ├── en/common.json      # source-of-truth catalog
    │   │   │       ├── nb/common.json      # Norwegian Bokmål (matches wireframe)
    │   │   │       ├── de/common.json
    │   │   │       ├── fr/common.json
    │   │   │       ├── es/common.json
    │   │   │       ├── it/common.json
    │   │   │       ├── nl/common.json
    │   │   │       ├── pl/common.json
    │   │   │       ├── pt/common.json
    │   │   │       ├── sv/common.json
    │   │   │       ├── da/common.json
    │   │   │       └── fi/common.json
    │   │   ├── lib/
    │   │   │   ├── wmo.ts          # WMO weather code → i18n key + icon + palette
    │   │   │   └── units.ts        # metric/imperial toggle (defaults derived from locale)
    │   │   ├── store/
    │   │   │   └── prefs.ts        # Zustand: units, themeOverride, languageOverride
    │   │   ├── styles/
    │   │   │   └── index.css
    │   │   └── test/
    │   │       ├── setup.ts        # MSW server, RTL config, i18n test bootstrap
    │   │       └── handlers.ts     # MSW handlers for /api/*
    │   └── tests/
    │       ├── unit/               # *.test.ts(x)
    │       ├── integration/        # full App rendering w/ MSW
    │       └── e2e/                # playwright smoke
    └── api/                        # Cloudflare Worker
        ├── wrangler.toml
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts            # Hono app, routes
        │   ├── routes/
        │   │   ├── weather.ts
        │   │   └── geocode.ts
        │   ├── do/
        │   │   └── WeatherCache.ts # Durable Object
        │   ├── upstream/
        │   │   └── openMeteo.ts    # typed upstream client
        │   └── types.ts
        └── test/
            ├── weatherCache.test.ts
            └── routes.test.ts      # uses unstable_dev / miniflare
```

---

## 4. Backend — Cloudflare Worker + Durable Object

### 4.1 Routes (Hono)

All under `/api`.

- `GET /api/geocode?q=<string>&limit=<n=5>`
  - Proxies Open-Meteo geocoding. Returns trimmed list `{ id, name, country, admin1, latitude, longitude, timezone }`.
  - Cached in DO under key `geo:<lower(q)>` with TTL 24h.
- `GET /api/weather?lat=<n>&lon=<n>&units=<metric|imperial>`
  - Returns `{ current, hourly, daily, location, fetchedAt, source: 'cache' | 'upstream' }`.
  - Cached in DO under key `wx:<round4(lat)>:<round4(lon)>:<units>` with TTL **10 minutes**.
- `GET /api/health` → `{ ok: true, version }`.

### 4.2 Durable Object: `WeatherCache`

- **SQLite storage backend** (free-tier requirement): the class declares `new_sqlite_classes = ["WeatherCache"]` in the `wrangler.toml` migration, and reads/writes via `this.state.storage.sql` (with a thin key-value-style table) plus the regular `this.state.storage` for simple per-row access. Legacy KV-backed DOs are not used.
- One DO per logical "shard". Use a single named instance `cache` via `idFromName('cache')` for simplicity (we are not high-traffic; brief asks DO as caching layer, not as horizontal scale).
- Schema (migration on first run): `CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL)` (we serialize `payload` as JSON).
- API (internal `fetch` on the DO):
  - `GET /get?key=...` → 200 `{ hit: true, payload }` if not expired, else 200 `{ hit: false }`.
  - `POST /set` body `{ key, payload, ttlMs }` → 204.
  - `POST /purge` body `{ prefix }` (admin only via header secret) → 204.
- Implement a tiny `setAlarm` to GC expired entries hourly (`DELETE FROM entries WHERE expires_at < ?`).

### 4.3 Upstream client (`openMeteo.ts`)

- Pure functions, no DO/Worker dependency, typed with Zod-validated responses.
- `geocode(q, limit)`, `forecast(lat, lon, units)`.
- Maps Open-Meteo response to our normalized shape so the frontend never sees raw upstream JSON.
- **Exact endpoints + parameters used (free tier, no key):**

  ```
  GET https://geocoding-api.open-meteo.com/v1/search
      ?name=<q>
      &count=<limit>            # max 10
      &language=<bcp47-primary> # optional, localizes admin1/country fields when supported
      &format=json
  ```

  ```
  GET https://api.open-meteo.com/v1/forecast
      ?latitude=<lat>
      &longitude=<lon>
      &current=temperature_2m,apparent_temperature,relative_humidity_2m,
               weather_code,is_day,wind_speed_10m,wind_direction_10m,
               precipitation,precipitation_probability,cloud_cover,pressure_msl
      &hourly=temperature_2m,precipitation_probability,weather_code
      &daily=weather_code,temperature_2m_max,temperature_2m_min,
             apparent_temperature_max,apparent_temperature_min,
             sunrise,sunset,uv_index_max,
             precipitation_sum,precipitation_probability_max,
             wind_speed_10m_max,wind_direction_10m_dominant
      &timezone=auto
      &temperature_unit=<celsius|fahrenheit>
      &wind_speed_unit=<kmh|mph>
      &precipitation_unit=<mm|inch>
      &forecast_days=7
  ```

- We display **only what the response contains.** Notably:
  - **UV index is daily-only** on the free tier (no `current.uv_index`); we surface it from `daily[0]`.
  - **Sunrise/sunset are daily-only**; we surface today's pair from `daily[0]`.
  - No air quality, no historical data, no radar — those are different endpoints / providers and out of scope.

### 4.4 Error handling

- Upstream timeout: 5s (`AbortController`). On failure return cached value (even if expired) with `stale: true`, else 502 `{ error, code }`.
- All responses JSON, never throw raw to client. Use Hono's `onError`.

### 4.5 wrangler.toml (sketch — Option A, single Worker with Static Assets)

```toml
name = "myweather"
main = "src/index.ts"
compatibility_date = "2025-09-01"
compatibility_flags = ["nodejs_compat"]

# Serve the SPA build directly from this Worker. Routes that don't match
# /api/* fall through to the static assets (with SPA fallback to index.html).
[assets]
directory = "../web/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"

[[durable_objects.bindings]]
name = "WEATHER_CACHE"
class_name = "WeatherCache"

# Free-tier requires the SQLite storage backend.
[[migrations]]
tag = "v1"
new_sqlite_classes = ["WeatherCache"]

[vars]
APP_ENV = "production"

[observability]
enabled = true
```

The Hono app handles `/api/*` itself; everything else delegates to `env.ASSETS.fetch(request)`, which serves the built SPA with SPA fallback so deep links (e.g. `/?lat=…&lon=…`) work.

Local dev: a single `pnpm dev` runs both apps via `pnpm -r --parallel run dev`. The Worker uses `wrangler dev` with `[assets].directory` pointing at `apps/web/dist` (or, for HMR, Vite runs on its own port and `wrangler dev` proxies the Vite dev server — concretely we use Vite's proxy in the other direction during dev: Vite serves the SPA and proxies `/api/*` to `wrangler dev` on `http://localhost:8787`). In production both are served by the one Worker.

---

## 5. Frontend

### 5.1 Visual design (from wireframe)

The primary view is composed of three zones on a calm, soft-grey background with generous whitespace. All copy below is shown in English (the source locale); the wireframe shows the same UI rendered in Norwegian. See §5.8 for the full localized copy table.

1. **Header row** — `MyWeather` wordmark top-left (proper noun, not translated); search field top-right with placeholder `Search for a city` (en) / `Søk etter by` (nb) / `Stadt suchen` (de) / etc., plus a magnifier icon. Search is the only interactive control on first load.
2. **Hero** (vertically centered) — city name in regular weight, then a very large temperature numeral (~12rem on desktop, formatted via `Intl.NumberFormat` so 27 renders as `27°` in English/Norwegian and `27°` in French — the degree glyph is universal but separators differ for negatives, etc.), with a large stylized weather illustration sitting _behind_ the temperature (sun + cloud composite that adapts to the WMO code). The illustration is decorative (`aria-hidden`) — the temperature and translated condition text carry the meaning.
3. **Recent searches strip** — pinned along the bottom, label `Recent searches` (en) / `Siste søk` (nb) / `Letzte Suchen` (de) / etc., above three card slots laid out horizontally. Each card: city name (semibold), temperature below it, small weather icon on the right. Cards are buttons; clicking restores that city.

Type scale:

- Brand: 1.25rem / medium.
- City name in hero: 2rem / regular.
- Temperature in hero: clamp(5rem, 12vw, 12rem) / light.
- Recent-card city: 1.125rem / semibold; temp: 1rem / regular.

Color/theme: neutral grey base from wireframe (`#9CA3AF`-ish) + card surface (`#E5E7EB`-ish). Implemented via CSS variables driven by current condition + day/night so a sunny day washes the page warmer, a rainy night cooler. All variants must hit AA contrast.

### 5.2 UX flow

1. **First load with no recent searches**: hero shows a friendly empty state (en: _"Search for a city to see the weather"_, key `empty.prompt`) and a "Use my location" link below it (`empty.useLocation`). Bottom strip is hidden.
2. **First load with recent searches in localStorage**: hero auto-loads the most recent city; bottom strip shows the rest.
3. User types in the search box → debounced (250ms) `useGeocode` query → typeahead dropdown anchored under the field. Each row uses `Intl.DisplayNames(locale, { type: 'region' })` to localize the country name (`Germany` → `Deutschland` in `de`, `Tyskland` in `nb`). Place names themselves stay as the geocoder returned them.
4. Select a result (mouse / Enter / arrow keys) → URL updates to `/?lat=…&lon=…&name=…&lang=<locale>` (lang only present if user manually overrode), `useWeather` runs, hero re-renders, the city is pushed to the front of the recent strip.
5. Click a recent-searches card → same as selecting from search.
6. **Elevations** (intentional additions, available below the hero / via a "More details" disclosure on mobile, always visible on desktop ≥lg) — strictly using fields Open-Meteo returns on the free tier:
   - Secondary stats: feels-like (`current.apparentTemperature`), humidity (`current.humidity`), wind speed + rotating direction arrow (`current.windSpeed` / `current.windDirection`), precipitation probability (`current.precipitationProbability` if present, else `daily[0].precipitationProbabilityMax`), today's sunrise/sunset (`daily[0]`), today's max UV index (`daily[0].uvIndexMax`), cloud cover, pressure.
   - Hourly forecast (next 24h) as a small chart on ≥md, horizontally scrollable strip on mobile.
   - 7-day forecast as a compact list with hi/lo bar; weekday names from `Intl.DateTimeFormat(locale, { weekday: 'short' })`.
7. **Header controls** sit left of the search field: unit toggle (°C / °F, default derived from locale — see §5.8) and language picker. Both persist to localStorage and override browser detection on subsequent loads.
8. **Theme backdrop** adapts to condition + day/night (animated gradient) — respects `prefers-reduced-motion`.
9. **Footer**: small attribution line `Weather data by Open-Meteo` linked to https://open-meteo.com/, in the active locale's typography. Required by their CC-BY 4.0 terms.

### 5.3 State management

- **TanStack Query** owns server cache, retries, stale time (60s for weather, 24h for geocode), background refetch on window focus.
- **Zustand** owns UI prefs: `units`, `recentSearches[]` (capped at 5, deduped, persisted to localStorage), `themeOverride`, `language`.
- URL is the source of truth for the currently displayed location (deep-linkable, shareable).

### 5.4 Responsiveness

Tailwind breakpoints, anchored to the wireframe's three zones:

- `<sm` (≤640px, mobile): header collapses — brand + language/unit picker on row 1, search field full-width on row 2. Hero centered, temperature scales down to ~5rem. Recent strip becomes a horizontal scroll-snap strip of cards. Elevations hidden behind a "More details" disclosure.
- `sm–lg` (641–1023px, tablet): wireframe layout in full. Recent strip shows up to 3 cards in a row, wrapping to 2 if width tight. Elevations appear below the hero as a 2-column grid.
- `≥lg` (≥1024px, desktop, **wireframe target**): exact wireframe composition — header row, centered hero, 3-card recent strip pinned near bottom. Elevations appear in a right-rail column on `≥xl` screens so the hero stays centered, otherwise stacked under the hero.

Note: copy length varies wildly across locales (German is famously ~30% longer than English). All flex/grid containers must allow wrapping; no text gets a fixed width. Visual regression at smallest breakpoint is verified with German + Finnish locales loaded.

Use container queries (`@container`) for the hero so the temperature size tracks the hero's width, not just the viewport (handy if the layout ever gets embedded).

### 5.5 Accessibility (jsx-a11y enforced)

- Combobox pattern for search (WAI-ARIA: `role=combobox`, `aria-expanded`, `aria-activedescendant`, full keyboard nav).
- All decorative icons / illustrations `aria-hidden="true"`; weather condition is always available as text in the DOM in the active locale (en: `Partly cloudy, 27°`; nb: `Delvis skyet, 27°`) even when only `27°` is visually shown.
- Recent-search cards are real `<button>` elements with descriptive `aria-label` built from i18n keys with ICU interpolation (en: `Show weather for Oslo, 25 degrees`).
- Color contrast ≥ AA across themes (verified with axe in CI via Playwright).
- Focus rings preserved, focus trap nowhere; skip-link to main content.
- `prefers-reduced-motion` disables backdrop animation and chart transitions.
- Live region (`aria-live=polite`) announces a localized "Weather for {city} updated" string after a successful fetch.
- `<html lang>` is updated reactively to the active locale (`en`, `nb`, `de`, …) so screen readers pick the right voice/pronunciation.
- Language picker is a real `<select>` (or accessible custom listbox) labelled `Language` / `Språk` / `Sprache` etc.; each option uses `Intl.DisplayNames(locale, { type: 'language' })` so users see their own language in their own script.

### 5.6 Loading / error / empty / offline states

All copy keyed in i18n catalogs.

- Skeleton hero (city placeholder + shimmering temperature block + grey illustration silhouette) and skeleton recent-cards during initial load.
- Inline error card under the hero with retry button on weather fetch fail; preserves search field and recent strip so the user can recover.
- Network offline banner via `navigator.onLine` + `online`/`offline` listeners (`states.offline`).
- Empty state in hero (`empty.prompt`): "Search for a city to see the weather" + small arrow pointing to the search field.
- "No results" state inside the search dropdown when geocoding returns 0 hits (`search.noResults`).

### 5.7 Polish ideas (creativity criterion)

- Animated weather backdrop (CSS gradients + subtle particle layer for rain/snow, gated by reduced-motion).
- Wind direction shown as a rotating arrow.
- Sunrise/sunset shown on a small day-arc SVG with current sun position.
- Subtle entry animation on the hero illustration when a new city is selected (scale + fade), reduced-motion safe.
- Optional: "Compare cities" stretch — pin a second city; only if all baseline DoD criteria are green.

### 5.8 Internationalization & localization

#### Supported locales

English is the source-of-truth catalog and the fallback. Initial supported set (12 EU/EEA locales):

| Code | Language                          | Default unit | Notes                                                  |
| ---- | --------------------------------- | ------------ | ------------------------------------------------------ |
| `en` | English (en-GB form for spelling) | metric (°C)  | Source / fallback                                      |
| `nb` | Norwegian Bokmål                  | metric (°C)  | Matches the wireframe                                  |
| `de` | German                            | metric (°C)  | Often the longest strings — used as length stress test |
| `fr` | French                            | metric (°C)  |                                                        |
| `es` | Spanish                           | metric (°C)  |                                                        |
| `it` | Italian                           | metric (°C)  |                                                        |
| `nl` | Dutch                             | metric (°C)  |                                                        |
| `pl` | Polish                            | metric (°C)  | Plural rules (one/few/many/other)                      |
| `pt` | Portuguese (pt-PT form)           | metric (°C)  |                                                        |
| `sv` | Swedish                           | metric (°C)  |                                                        |
| `da` | Danish                            | metric (°C)  |                                                        |
| `fi` | Finnish                           | metric (°C)  | Long compounds — used as wrap stress test              |

(Adding more EU locales is a config + translation drop with no code change. RTL is not in scope; documented.)

#### Locale resolution order

Resolved once at app boot and stored in the `prefs` Zustand slice:

1. `?lang=<bcp47>` URL parameter (sharing override). If supported, wins.
2. `localStorage.lang` (manual override persisted from the language picker).
3. `navigator.languages` matched against the supported list using a best-match algorithm (`Intl.Locale` + a small `bestMatch` helper that tries language+region, then language only).
4. Fallback: `en`.

Whatever wins is written to `<html lang>` and used as the i18next active language. Switching the picker writes to localStorage and updates the URL only if the user clicks "share this view" (we don't pollute the URL on every change).

#### Catalogs

- JSON files at `apps/web/src/i18n/locales/<lang>/common.json`, lazy-loaded via dynamic `import()` so non-active locales never enter the initial bundle.
- Single namespace `common` for now; ready to split (`common`, `weather`, `errors`) if it grows.
- `en/common.json` is the source. A `pnpm i18n:check` script (custom, ~30 LOC) compares every other catalog against `en` and fails CI if a key is missing or has the same string as English where it shouldn't (basic untranslated-key heuristic).
- ICU message format is used for plurals and gendered strings (`{count, plural, one {# day} other {# days}}`).

#### Formatting (no extra deps; pure `Intl.*`)

`apps/web/src/i18n/format.ts` exposes:

- `formatTemperature(value, units, locale)` → uses `Intl.NumberFormat(locale, { style: 'unit', unit: 'celsius' | 'fahrenheit', maximumFractionDigits: 0 })`.
- `formatTime(date, locale, timeZone)` → `Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone })`. Respects 12h vs 24h convention per locale automatically.
- `formatWeekday(date, locale, timeZone)` → `Intl.DateTimeFormat(locale, { weekday: 'short', timeZone })`.
- `formatRelativeTime(from, to, locale)` → `Intl.RelativeTimeFormat(locale, { numeric: 'auto' })` for "Updated 5 minutes ago".
- `formatCountry(code, locale)` → `Intl.DisplayNames(locale, { type: 'region' })`.
- `formatList(items, locale)` → `Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })` for sentences like "Berlin, Paris and Madrid".

Units default per locale (metric for all currently-supported locales) but the user can flip and the choice persists.

#### Sample copy table (excerpt — `apps/web/src/i18n/locales/<lang>/common.json` keys)

| Key                        | en                                      | nb                                  | de                                                    |
| -------------------------- | --------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `header.searchPlaceholder` | Search for a city                       | Søk etter by                        | Stadt suchen                                          |
| `header.unit.metric`       | °C                                      | °C                                  | °C                                                    |
| `header.unit.imperial`     | °F                                      | °F                                  | °F                                                    |
| `header.languageLabel`     | Language                                | Språk                               | Sprache                                               |
| `empty.prompt`             | Search for a city to see the weather    | Søk etter en by for å se været      | Suchen Sie nach einer Stadt, um das Wetter zu sehen   |
| `empty.useLocation`        | Use my location                         | Bruk min posisjon                   | Meinen Standort verwenden                             |
| `recents.title`            | Recent searches                         | Siste søk                           | Letzte Suchen                                         |
| `recents.cardLabel`        | Show weather for {city}, {temp} degrees | Vis vær for {city}, {temp} grader   | Wetter für {city} anzeigen, {temp} Grad               |
| `weather.feelsLike`        | Feels like {temp}                       | Føles som {temp}                    | Gefühlt {temp}                                        |
| `weather.code.0`           | Clear sky                               | Klart                               | Klarer Himmel                                         |
| `weather.code.61`          | Light rain                              | Lett regn                           | Leichter Regen                                        |
| `errors.fetchFailed`       | Couldn't load the weather. Try again.   | Kunne ikke laste været. Prøv igjen. | Wetter konnte nicht geladen werden. Erneut versuchen. |
| `states.offline`           | You're offline                          | Du er frakoblet                     | Sie sind offline                                      |
| `liveRegion.updated`       | Weather for {city} updated              | Vær for {city} oppdatert            | Wetter für {city} aktualisiert                        |

Other locales mirror the same key set. WMO weather codes map to keys `weather.code.<code>` (e.g. `0` → "Clear sky") so the WMO mapper in `lib/wmo.ts` returns _keys_, not strings, and the components translate at render time.

#### Test coverage for i18n

- Unit: `formatTemperature(27, 'metric', 'en')` → `"27°C"`; same for `de`, `nb`, `fr`. Negative values, zero, °F variants.
- Unit: `formatRelativeTime(now - 5min, now, 'pl')` → `"5 minut temu"`.
- Unit: `bestMatch(['fr-CA', 'es-MX'])` against supported set picks `fr` (closest).
- Unit: catalog completeness — every non-`en` JSON has the same keys as `en`, no empty values.
- Integration: render App with `navigator.languages = ['de-DE', 'en']` → search placeholder is `Stadt suchen`, recent strip label is `Letzte Suchen`, `<html lang>` is `de`.
- Integration: switch via language picker `de` → `nb` → strings update without reload, `<html lang>` updates, choice persists across remount.
- Integration: visit `/?lang=fi` directly — UI is in Finnish regardless of browser locale.
- Visual: at 320px width with `de` and `fi` loaded, no layout overflow on header or hero.

---

## 6. API contracts (frontend ↔ worker)

The shapes below mirror exactly what the free Open-Meteo tier returns — no field is invented or filled with mock data. Optional fields are only present when the upstream actually provides them.

```ts
// shared/types.ts (duplicated to both apps or via a small workspace package)
export type Units = 'metric' | 'imperial';

export interface GeocodeResult {
  id: string; // upstream id
  name: string;
  country: string;
  countryCode: string; // ISO-2, for flag rendering
  admin1?: string; // region/state, when present
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface WeatherResponse {
  location: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  units: Units;
  // Mirrors Open-Meteo `current` block. UV index, sunrise, sunset are NOT here —
  // the free tier exposes them only on `daily`.
  current: {
    time: string; // ISO
    temperature: number;
    apparentTemperature: number;
    humidity: number; // %
    windSpeed: number;
    windDirection: number; // degrees, meteorological
    precipitation: number;
    precipitationProbability?: number; // present in current on Open-Meteo
    cloudCover: number; // %
    pressureMsl: number; // hPa
    weatherCode: number; // WMO
    isDay: boolean;
  };
  hourly: Array<{
    time: string;
    temperature: number;
    precipitationProbability: number;
    weatherCode: number;
  }>;
  daily: Array<{
    date: string;
    weatherCode: number;
    tempMax: number;
    tempMin: number;
    apparentTempMax: number;
    apparentTempMin: number;
    sunrise: string; // ISO, location-local
    sunset: string; // ISO, location-local
    uvIndexMax: number;
    precipitationSum: number;
    precipitationProbabilityMax: number;
    windSpeedMax: number;
    windDirectionDominant: number;
  }>;
  fetchedAt: string; // ISO, when our worker fetched upstream
  source: 'cache' | 'upstream' | 'stale';
  attribution: 'Open-Meteo'; // constant, surfaced in UI footer
}
```

The frontend reads `daily[0]` for "today's" sunrise / sunset / UV index when displaying current-conditions stats, since the free tier doesn't put them on `current`.

---

## 7. Testing strategy

Coverage target: **80% statements** on `apps/web/src` and `apps/api/src`. CI fails below.

### 7.1 Unit (Vitest)

- `lib/wmo.ts`: every documented WMO code maps to an i18n key, icon, and palette; unknown code falls back gracefully.
- `i18n/format.ts`: temperature rounding, °C ↔ °F conversion, locale-aware number/time/relative-time/list/region formatting (sample matrix across `en`, `nb`, `de`, `fr`, `pl`, `fi`).
- `i18n/index.ts`: locale resolution priority (URL > localStorage > navigator > `en` fallback) + `bestMatch` for region variants.
- Catalog completeness check: every non-`en` JSON has the same keys as `en`, no missing/empty values.
- `hooks/useDebouncedValue`: debounce timing.
- `hooks/useRecentSearches`: dedupe, cap at 5, persistence (mock localStorage).
- `store/prefs`: persistence + hydration of `units`, `languageOverride`, `themeOverride`.
- API: `WeatherCache` storage put/get/expiry, `openMeteo` mapper given fixture JSON.

### 7.2 Integration (Vitest + RTL + MSW)

- Default locale boot: with `navigator.languages = ['en-US']` and empty localStorage, app renders English empty-state copy ("Search for a city…") and no recent strip.
- Browser locale detection: with `navigator.languages = ['de-DE','en']`, header placeholder reads `Stadt suchen`, recent label reads `Letzte Suchen`, `<html lang>` is `de`.
- URL override wins: visiting `/?lang=fi` renders Finnish copy regardless of `navigator.languages`.
- Type "Fred" in search → dropdown shows Fredrikstad with country localized (en: "Norway", de: "Norwegen") → click → hero renders city + temperature with mocked data; URL updated; recent strip now contains Fredrikstad as the first card.
- Click a recent card (Oslo) → hero re-renders for Oslo; URL updated; Oslo moves to front of strip.
- Toggle units: hero and recent-card temperatures re-render in °F using `Intl.NumberFormat`.
- Switch language via header picker: `en` → `nb` updates all visible strings without reload, persists across remount.
- Network error: inline error card under hero with working retry, copy in active locale; search and recent strip remain interactive.
- Recent searches persist across remount (localStorage), capped at 5, deduped.
- Keyboard: Tab reaches search field, ↓/↑/Enter on combobox selects result, Escape closes dropdown.
- Worker integration: spin up worker via `unstable_dev`, hit `/api/weather` twice, second response has `source: 'cache'`.

### 7.3 E2E (Playwright, smoke spec matrix)

- Visit deployed preview / local prod build with default English locale, search "Fredrikstad", assert hero renders city name and a numeric temperature ending with `°`.
- Repeat with `?lang=de` — assert German placeholder and recent-search label render.
- Run axe-core on both runs, assert no serious/critical a11y violations.

### 7.4 Manual QA checklist (in README)

- iPhone SE width (375px), iPad, 1440 desktop, 4K.
- Keyboard-only run-through.
- Throttled 3G load.
- Dark / light system theme.

---

## 8. CI / CD

Deployment target: **single Cloudflare Worker with Static Assets** (Option A, locked in §0.1). One workflow, one deploy command.

`.github/workflows/ci.yml`:

1. Setup pnpm + Node 20.
2. `pnpm install --frozen-lockfile`.
3. `pnpm -r typecheck`.
4. `pnpm -r lint`.
5. `pnpm -r test -- --coverage`.
6. `pnpm i18n:check` (catalog completeness against `en`).
7. `pnpm -r build` — builds `apps/web` to `apps/web/dist`, which the Worker's `[assets]` binding will pick up.
8. (on `main` only) `pnpm --filter @myweather/api run deploy` → invokes `wrangler deploy`. The single resulting URL (e.g. `https://myweather.<account>.workers.dev`) serves both the SPA and `/api/*`.

Secrets in GitHub: `CLOUDFLARE_API_TOKEN` (custom token scoped to `Workers Scripts: Edit` + `Account: Read`, plus DO read/write — the wrangler dashboard provides a one-click template), `CLOUDFLARE_ACCOUNT_ID`. No upstream API keys needed (Open-Meteo is free + no-registration).

Deployment URL is published to the workflow summary, the README, and any PR description.

---

## 9. Definition of done

- [ ] Repo runs end-to-end locally with `pnpm i && pnpm dev` (Vite + wrangler dev concurrently via `pnpm -r --parallel run dev`) — no API keys / signup required to run against live data.
- [ ] Search + current + hourly + daily forecast all work against live Open-Meteo using only fields the free tier returns; nothing is mocked or invented in production.
- [ ] `Weather data by Open-Meteo` attribution is rendered in the footer and present in the README, satisfying CC-BY 4.0.
- [ ] Repeat fetch within 10 minutes returns `source: 'cache'` from the Durable Object.
- [ ] Layout works at 320px → 1920px+ widths, verified manually with both English and German locales loaded.
- [ ] All a11y CI checks pass; keyboard-only flow works; `<html lang>` matches active locale.
- [ ] All 12 supported locales (`en`, `nb`, `de`, `fr`, `es`, `it`, `nl`, `pl`, `pt`, `sv`, `da`, `fi`) have complete JSON catalogs; `pnpm i18n:check` passes in CI.
- [ ] Browser-locale detection works (verified by integration tests for at least `en`, `de`, `nb`, `fi`); URL `?lang=` override works; user override via header picker persists.
- [ ] Numbers, temperatures, times, weekdays and country names use `Intl.*` per active locale.
- [ ] Unit + integration suites green, ≥80% coverage; E2E smoke green for `en` and `de`.
- [ ] Deployed as a **single Worker with Static Assets** (SPA + `/api/*`) on Cloudflare's free tier (DO uses SQLite backend), public URL linked in README.
- [ ] README documents: stack rationale, run/test/deploy commands, architecture diagram, i18n architecture + how to add a new locale, trade-offs, and "what I'd do next" (incl. RTL note).

---

## 10. Implementation order (for the agent to execute)

1. Scaffold pnpm workspace, `apps/web` (Vite React TS) and `apps/api` (Worker TS).
2. Set up shared tsconfig, eslint, prettier, husky/lint-staged (light), CI skeleton (incl. `pnpm i18n:check`).
3. Build the Worker: Open-Meteo client + routes + `WeatherCache` DO + tests.
4. Wire Vite dev proxy to `wrangler dev`.
5. **i18n foundation**: `react-i18next` init, locale resolution helper (`bestMatch` over `navigator.languages`), `Intl.*` formatters in `i18n/format.ts`, `en/common.json` source catalog, lazy-loader for non-active locales, `<html lang>` sync.
6. Frontend shell: design tokens (CSS vars), Tailwind theme, `AppHeader` with brand + language picker + units toggle + search combobox, `useGeocode` hook.
7. **Wireframe-faithful primary view**: `CurrentWeatherHero` (city + huge temp + `WeatherIllustration`) + `RecentSearches` strip with `RecentSearchCard`. With `?lang=nb` this view should match the wireframe at desktop width.
8. Empty / error / offline / skeleton states + theme backdrop + a11y polish (combobox, live region, focus rings).
9. **Elevations** (intentionally beyond wireframe): `SecondaryStats`, `HourlyForecast`, `DailyForecast`, geolocation button.
10. **Locale rollout**: produce the remaining 11 catalogs (`nb`, `de`, `fr`, `es`, `it`, `nl`, `pl`, `pt`, `sv`, `da`, `fi`) keyed off `en`; verify `pnpm i18n:check` and the integration tests pass.
11. Responsiveness pass at 320 / 768 / 1024 / 1440 widths with `de` and `fi` loaded as length stress tests; container query polish on hero.
12. Tests to coverage target + Playwright smoke (`en` and `de`).
13. Deploy via `wrangler deploy` (single Worker, Static Assets binding to `apps/web/dist`, SQLite-backed `WeatherCache` DO); verify `/api/*` and the SPA both served from the resulting `*.workers.dev` URL; capture URL; finalize README (call out wireframe match, the elevations, the i18n architecture + how to add a locale, and the deploy story).

Each step is a self-contained commit/PR-sized chunk so progress is reviewable. Step 7 is the "screenshot moment" — once it lands, visiting `/?lang=nb` should be visually identical to `wireframe.png` for the happy path before anything else is layered on.
