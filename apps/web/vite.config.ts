import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * MyWeather frontend — see SPEC.md §4.6.
 *
 * In dev, Vite serves the SPA on :5173 and proxies `/api/*` to `wrangler dev`
 * on :8787, so the frontend talks to the same path it will in production
 * (the Worker mounts `/api` and falls through to ASSETS for everything else).
 *
 * Run both with `pnpm dev` from the repo root.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Force a single `i18next` instance across the bundle. Without this,
    // Vite's dep optimizer pre-bundles one copy for our app code (which
    // imports the singleton via `src/i18n/index.ts`) and a separate copy
    // for `react-i18next`, so `useTranslation()` reads from a different
    // i18n instance than the one we configure — leading to a stale
    // `i18n.resolvedLanguage` in the LanguagePicker on first paint with a
    // non-English persisted locale.
    dedupe: ['i18next', 'react-i18next'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
