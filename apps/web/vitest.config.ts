import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Standalone vitest config — does NOT extend `vite.config.ts` because the
 * Vite proxy etc. has nothing to offer the test runner. The plugins list
 * stays in sync because we want JSX in tests to compile the same way it
 * does in the SPA.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
