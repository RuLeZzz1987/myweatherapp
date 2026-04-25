/**
 * Per-test bootstrapping for vitest + React Testing Library.
 *
 * - `@testing-library/jest-dom/vitest` augments `expect()` with DOM
 *   matchers (e.g. `toBeInTheDocument()`).
 * - We unmount components after each test and clear localStorage so
 *   i18next's persisted language preference doesn't bleed across tests.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});
