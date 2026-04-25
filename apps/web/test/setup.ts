/**
 * Per-test bootstrapping for vitest + React Testing Library + MSW.
 *
 * - `@testing-library/jest-dom/vitest` augments `expect()` with DOM
 *   matchers (e.g. `toBeInTheDocument()`).
 * - The MSW node server runs for the whole suite; each test gets a clean
 *   handler set so `server.use(...)` overrides don't leak.
 * - Components are unmounted and localStorage is cleared after each test
 *   so i18next's persisted language preference and the prefs Zustand
 *   slice don't bleed across tests.
 */

import '@testing-library/jest-dom/vitest';
// Side-effect import — initializes the i18next singleton (resources,
// detector, default lng) before any component test imports
// `react-i18next` and tries to read from it. App.test.tsx happened to
// import this directly; now every test gets it via the setup file.
import '../src/i18n';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

afterAll(() => {
  server.close();
});
