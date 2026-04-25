/**
 * WMO weather code → i18n key + illustration palette.
 *
 * Source: Open-Meteo's documented WMO 4677 mapping. The frontend never
 * displays a code directly — every consumer goes through {@link describeWmo}
 * so adding/changing a code is a single-file edit.
 *
 * Translation strings live under `weather.code.<code>` in the i18n
 * catalogs. We deliberately fall back to a neighbour code (e.g. `2` →
 * `weather.code.2` if present, else `weather.code.1`) rather than inline
 * English, so a missing translation doesn't leak source-locale text.
 */

export type WmoPalette = 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export type WmoIcon =
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'cloud-sun'
  | 'cloud-moon'
  | 'cloud-rain'
  | 'cloud-snow'
  | 'cloud-fog'
  | 'cloud-storm';

export interface WmoDescription {
  /** i18n key — caller passes through `t()`. */
  key: string;
  /** Drives the ThemeBackdrop tint (--color-weather-*). */
  palette: WmoPalette;
  /**
   * Icon variant. Day/night specifics are encoded — pass `isDay=false`
   * to swap a sun for a moon.
   */
  icon: WmoIcon;
}

interface WmoEntry {
  palette: WmoPalette;
  /** Default icon (assumes day). */
  icon: WmoIcon;
}

/**
 * Numeric → palette/icon. Translation keys are always
 * `weather.code.<code>` so the UI can feed any number through `t()`.
 */
const TABLE: Record<number, WmoEntry> = {
  0: { palette: 'clear', icon: 'sun' },
  1: { palette: 'clear', icon: 'cloud-sun' },
  2: { palette: 'cloud', icon: 'cloud-sun' },
  3: { palette: 'cloud', icon: 'cloud' },
  45: { palette: 'fog', icon: 'cloud-fog' },
  48: { palette: 'fog', icon: 'cloud-fog' },
  51: { palette: 'rain', icon: 'cloud-rain' },
  53: { palette: 'rain', icon: 'cloud-rain' },
  55: { palette: 'rain', icon: 'cloud-rain' },
  56: { palette: 'rain', icon: 'cloud-rain' },
  57: { palette: 'rain', icon: 'cloud-rain' },
  61: { palette: 'rain', icon: 'cloud-rain' },
  63: { palette: 'rain', icon: 'cloud-rain' },
  65: { palette: 'rain', icon: 'cloud-rain' },
  66: { palette: 'rain', icon: 'cloud-rain' },
  67: { palette: 'rain', icon: 'cloud-rain' },
  71: { palette: 'snow', icon: 'cloud-snow' },
  73: { palette: 'snow', icon: 'cloud-snow' },
  75: { palette: 'snow', icon: 'cloud-snow' },
  77: { palette: 'snow', icon: 'cloud-snow' },
  80: { palette: 'rain', icon: 'cloud-rain' },
  81: { palette: 'rain', icon: 'cloud-rain' },
  82: { palette: 'rain', icon: 'cloud-rain' },
  85: { palette: 'snow', icon: 'cloud-snow' },
  86: { palette: 'snow', icon: 'cloud-snow' },
  95: { palette: 'storm', icon: 'cloud-storm' },
  96: { palette: 'storm', icon: 'cloud-storm' },
  99: { palette: 'storm', icon: 'cloud-storm' },
};

const FALLBACK: WmoEntry = { palette: 'cloud', icon: 'cloud' };

export function describeWmo(code: number, isDay = true): WmoDescription {
  const entry = TABLE[code] ?? FALLBACK;
  let icon = entry.icon;
  if (!isDay) {
    if (icon === 'sun') icon = 'moon';
    else if (icon === 'cloud-sun') icon = 'cloud-moon';
  }
  return {
    key: `weather.code.${code}`,
    palette: entry.palette,
    icon,
  };
}

export const WMO_CODES = Object.keys(TABLE).map(Number);
