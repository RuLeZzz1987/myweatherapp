import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/client';
import { reportQueryError, shouldReport } from '../sentry';

describe('shouldReport', () => {
  it('reports unknown errors', () => {
    expect(shouldReport(new Error('boom'))).toBe(true);
  });

  it('reports 5xx ApiErrors', () => {
    expect(shouldReport(new ApiError('upstream', 502))).toBe(true);
    expect(shouldReport(new ApiError('upstream', 504))).toBe(true);
  });

  it('skips 4xx ApiErrors (user/input issue, not a bug)', () => {
    expect(shouldReport(new ApiError('bad query', 400))).toBe(false);
    expect(shouldReport(new ApiError('not found', 404))).toBe(false);
  });

  it('skips AbortError (user navigated away)', () => {
    const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(shouldReport(aborted)).toBe(false);
  });

  it('reports primitive / null gracefully', () => {
    expect(shouldReport(null)).toBe(true);
    expect(shouldReport('boom')).toBe(true);
  });
});

describe('reportQueryError', () => {
  // Without `initSentry()` running first, reportQueryError is a no-op
  // and returns false. This is exactly the dev/test contract we want.
  it('no-ops without an initialized SDK', () => {
    expect(
      reportQueryError(new ApiError('upstream', 502), { area: 'weather', queryKey: ['weather'] }),
    ).toBe(false);
  });

  it('still no-ops when the gate would also reject', () => {
    expect(reportQueryError(new ApiError('bad', 400), { area: 'geocode' })).toBe(false);
  });
});
