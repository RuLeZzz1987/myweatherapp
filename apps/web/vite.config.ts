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
