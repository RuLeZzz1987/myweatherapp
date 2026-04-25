/**
 * Frontend mirror of the API contract documented in SPEC.md §6 and
 * implemented in `apps/api/src/types.ts`. Hand-duplicated rather than
 * imported across workspace boundaries to keep the web app trivially
 * type-checkable on its own (no `tsconfig` projects-references gymnastics)
 * and to make the backend's type changes show up as TS errors here.
 *
 * If a field is missing on the upstream Open-Meteo response we don't
 * invent it — see SPEC §4.3 for the field-by-field treatment.
 */

export type Units = 'metric' | 'imperial';

export interface GeocodeResult {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface GeocodeResponse {
  results: GeocodeResult[];
  cachedAt: string;
  source: 'cache' | 'upstream' | 'stale';
}
