import { describe, expect, it } from 'vitest';

import { WMO_CODES, describeWmo } from '../wmo';

describe('describeWmo', () => {
  it('maps every documented WMO code to a key, palette, and icon', () => {
    for (const code of WMO_CODES) {
      const desc = describeWmo(code);
      expect(desc.key).toBe(`weather.code.${code}`);
      expect(desc.palette).toMatch(/^(clear|cloud|fog|rain|snow|storm)$/);
      expect(desc.icon).toMatch(
        /^(sun|moon|cloud|cloud-sun|cloud-moon|cloud-rain|cloud-snow|cloud-fog|cloud-storm)$/,
      );
    }
  });

  it('falls back to a cloud palette for an unknown code', () => {
    const desc = describeWmo(9999);
    expect(desc.palette).toBe('cloud');
    expect(desc.icon).toBe('cloud');
    expect(desc.key).toBe('weather.code.9999');
  });

  it('swaps sun for moon at night', () => {
    expect(describeWmo(0, true).icon).toBe('sun');
    expect(describeWmo(0, false).icon).toBe('moon');
  });

  it('swaps cloud-sun for cloud-moon at night', () => {
    expect(describeWmo(1, true).icon).toBe('cloud-sun');
    expect(describeWmo(1, false).icon).toBe('cloud-moon');
  });

  it('does not change icons that have no day/night variant', () => {
    expect(describeWmo(61, true).icon).toBe('cloud-rain');
    expect(describeWmo(61, false).icon).toBe('cloud-rain');
  });

  it('groups thunderstorm codes under the storm palette', () => {
    expect(describeWmo(95).palette).toBe('storm');
    expect(describeWmo(96).palette).toBe('storm');
    expect(describeWmo(99).palette).toBe('storm');
  });

  it('groups snow codes under the snow palette', () => {
    expect(describeWmo(71).palette).toBe('snow');
    expect(describeWmo(85).palette).toBe('snow');
  });
});
