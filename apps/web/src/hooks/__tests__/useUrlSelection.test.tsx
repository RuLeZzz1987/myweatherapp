import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { selectionFromGeocode, useUrlSelection } from '../useUrlSelection';

describe('useUrlSelection', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('returns null when the URL has no lat/lon', () => {
    const { result } = renderHook(() => useUrlSelection());
    expect(result.current.selection).toBeNull();
  });

  it('parses a deep-linked selection from the URL', () => {
    window.history.replaceState(
      null,
      '',
      '/?lat=59.9139&lon=10.7522&name=Oslo&country=Norway&id=3143244&cc=NO',
    );
    const { result } = renderHook(() => useUrlSelection());
    expect(result.current.selection).toMatchObject({
      id: '3143244',
      lat: 59.9139,
      lon: 10.7522,
      name: 'Oslo',
      country: 'Norway',
      countryCode: 'NO',
    });
  });

  it('rejects out-of-range coords', () => {
    window.history.replaceState(null, '', '/?lat=999&lon=999');
    const { result } = renderHook(() => useUrlSelection());
    expect(result.current.selection).toBeNull();
  });

  it('writes selection back to the URL via replaceState by default', () => {
    const { result } = renderHook(() => useUrlSelection());
    act(() => {
      result.current.setSelection({
        id: '2950159',
        lat: 52.52,
        lon: 13.405,
        name: 'Berlin',
        country: 'Germany',
        countryCode: 'DE',
      });
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.get('id')).toBe('2950159');
    expect(params.get('lat')).toBe('52.5200');
    expect(params.get('lon')).toBe('13.4050');
    expect(params.get('name')).toBe('Berlin');
    expect(params.get('cc')).toBe('DE');
  });

  it('uses pushState when push: true is passed', () => {
    const before = window.history.length;
    const { result } = renderHook(() => useUrlSelection());
    act(() => {
      result.current.setSelection({ lat: 1, lon: 2, name: 'A', country: 'B' }, { push: true });
    });
    expect(window.history.length).toBeGreaterThan(before);
  });

  it('clears the URL when selection is set to null', () => {
    window.history.replaceState(null, '', '/?lat=1&lon=2&name=Foo&country=Bar');
    const { result } = renderHook(() => useUrlSelection());
    act(() => {
      result.current.setSelection(null);
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.get('lat')).toBeNull();
    expect(params.get('lon')).toBeNull();
    expect(params.get('name')).toBeNull();
  });

  it('preserves the lang query param across writes', () => {
    window.history.replaceState(null, '', '/?lang=de');
    const { result } = renderHook(() => useUrlSelection());
    act(() => {
      result.current.setSelection({ lat: 1, lon: 2, name: 'A', country: 'B' });
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.get('lang')).toBe('de');
  });

  it('selectionFromGeocode maps the relevant fields', () => {
    const sel = selectionFromGeocode({
      id: '1',
      name: 'X',
      country: 'Y',
      countryCode: 'XY',
      latitude: 10,
      longitude: 20,
      timezone: 'UTC',
    });
    expect(sel).toEqual({
      id: '1',
      lat: 10,
      lon: 20,
      name: 'X',
      country: 'Y',
      countryCode: 'XY',
      timezone: 'UTC',
    });
  });
});
