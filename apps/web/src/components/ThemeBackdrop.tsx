import type { ReactNode } from 'react';

import { describeWmo, type WmoPalette } from '../lib/wmo';

/**
 * Tints the surrounding surface based on the current weather code.
 * Maps the WMO palette → one of the `--color-weather-*` design tokens
 * defined in `index.css`. Day/night is honored: at night we shift to
 * the dedicated night swatch regardless of palette.
 *
 * Renders a `<div>` rather than mutating `<body>` so the rest of the
 * app keeps a stable background and the tinted surface is scoped to
 * the hero region. The tint sits behind content via a wrapping
 * relative container in the consumer.
 */

export interface ThemeBackdropProps {
  weatherCode: number | null;
  isDay?: boolean;
  children?: ReactNode;
  className?: string;
}

const PALETTE_TOKEN: Record<WmoPalette, string> = {
  clear: 'var(--color-weather-clear)',
  cloud: 'var(--color-weather-cloud)',
  fog: 'var(--color-weather-cloud)',
  rain: 'var(--color-weather-rain)',
  snow: 'var(--color-weather-snow)',
  storm: 'var(--color-weather-rain)',
};

export function ThemeBackdrop({
  weatherCode,
  isDay = true,
  children,
  className,
}: ThemeBackdropProps) {
  const palette = weatherCode != null ? describeWmo(weatherCode, isDay).palette : 'cloud';
  const background = isDay ? PALETTE_TOKEN[palette] : 'var(--color-weather-night)';

  return (
    <div
      data-palette={palette}
      data-day={isDay}
      style={{ backgroundColor: background }}
      className={`relative overflow-hidden rounded-3xl transition-colors duration-700 ${
        className ?? ''
      }`}
    >
      {children}
    </div>
  );
}
