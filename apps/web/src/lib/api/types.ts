/**
 * Re-export of the wire contracts that live in `@myweather/contracts`.
 *
 * Keeping the existing `'../../lib/api/types'` import paths working
 * means components and tests don't need to be touched when the contracts
 * move; we just point this barrel at the shared workspace package. See
 * SPEC.md §6 for the contract itself.
 */

export type {
  Units,
  GeocodeResult,
  GeocodeResponse,
  WeatherCurrent,
  WeatherHourly,
  WeatherDaily,
  WeatherResponse,
} from '@myweather/contracts';
