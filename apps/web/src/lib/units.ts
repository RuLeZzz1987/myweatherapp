/**
 * Unit-aware formatting for the secondary stats panel and forecast
 * strips. The `Units` toggle decides which unit symbols appear and
 * which numeric strings the worker would have returned, but the
 * payload itself already carries the right magnitudes — the worker
 * asks Open-Meteo for °F/mph/inch when imperial is selected, so we
 * only need to format here, not convert.
 */

import type { Units } from './api/types';

export type SpeedUnit = 'kmh' | 'mph';
export type LengthUnit = 'mm' | 'in';

export function speedUnit(units: Units): SpeedUnit {
  return units === 'metric' ? 'kmh' : 'mph';
}

export function precipUnit(units: Units): LengthUnit {
  return units === 'metric' ? 'mm' : 'in';
}

/** Round to the nearest integer; locale formatting is handled by callers. */
export function roundInt(n: number): number {
  return Math.round(n);
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CompassPoint = (typeof COMPASS)[number];

/**
 * Map a meteorological wind direction (degrees, 0 = N, clockwise) to
 * one of 8 cardinal points. Resolution beyond 8 buckets is more than
 * the typical free-tier model can give, so we don't overpromise.
 */
export function compassPoint(degrees: number): CompassPoint {
  const normalized = ((degrees % 360) + 360) % 360;
  const idx = Math.round(normalized / 45) % 8;
  return COMPASS[idx]!;
}
