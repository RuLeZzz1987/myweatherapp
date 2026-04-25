import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * MSW Node server — used by Vitest under the jsdom environment. Started
 * once for the suite (see `setup.ts`); individual tests can layer
 * per-test overrides with `server.use(...)`, which `resetHandlers()`
 * reverts after each test.
 */
export const server = setupServer(...handlers);
