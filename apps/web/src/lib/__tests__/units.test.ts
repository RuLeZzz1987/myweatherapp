import { describe, expect, it } from 'vitest';

import { compassPoint, precipUnit, roundInt, speedUnit } from '../units';

describe('units', () => {
  it('selects km/h for metric and mph for imperial', () => {
    expect(speedUnit('metric')).toBe('kmh');
    expect(speedUnit('imperial')).toBe('mph');
  });

  it('selects mm for metric and in for imperial', () => {
    expect(precipUnit('metric')).toBe('mm');
    expect(precipUnit('imperial')).toBe('in');
  });

  it('rounds to nearest integer', () => {
    expect(roundInt(8.4)).toBe(8);
    expect(roundInt(8.5)).toBe(9);
    expect(roundInt(-8.5)).toBe(-8);
  });

  describe('compassPoint', () => {
    it('maps cardinal degrees to N/E/S/W', () => {
      expect(compassPoint(0)).toBe('N');
      expect(compassPoint(90)).toBe('E');
      expect(compassPoint(180)).toBe('S');
      expect(compassPoint(270)).toBe('W');
    });

    it('rounds to nearest 8th of a circle', () => {
      expect(compassPoint(22)).toBe('N');
      expect(compassPoint(23)).toBe('NE');
      expect(compassPoint(135)).toBe('SE');
      expect(compassPoint(225)).toBe('SW');
    });

    it('wraps negative and >360 degrees', () => {
      expect(compassPoint(-90)).toBe('W');
      expect(compassPoint(450)).toBe('E');
    });
  });
});
