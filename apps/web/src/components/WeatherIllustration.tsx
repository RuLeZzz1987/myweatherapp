import { describeWmo, type WmoIcon } from '../lib/wmo';

/**
 * Stylized SVG illustration for the hero — sized off the parent's font
 * size (`1em` width), so callers control scale via CSS. Variants are
 * keyed off the WMO code so a single `weatherCode` + `isDay` pair is
 * enough to render the right glyph; everything else (tint, stroke) is
 * inherited from the surrounding ThemeBackdrop's CSS variables.
 *
 * Decorative — the visible weather text describes the condition. We
 * mark it `aria-hidden` and pair it with a short visually-hidden label
 * in the consumer (`hero.labelCondition`).
 */

export interface WeatherIllustrationProps {
  weatherCode: number;
  isDay?: boolean;
  className?: string;
  /** Pixel size override (defaults to `1em`). */
  size?: number | string;
}

export function WeatherIllustration({
  weatherCode,
  isDay = true,
  className,
  size = '1em',
}: WeatherIllustrationProps) {
  const desc = describeWmo(weatherCode, isDay);
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      role="img"
      aria-hidden="true"
      data-palette={desc.palette}
      data-icon={desc.icon}
      viewBox="0 0 100 100"
      width={dimension}
      height={dimension}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderGlyph(desc.icon)}
    </svg>
  );
}

function renderGlyph(icon: WmoIcon): React.ReactElement {
  switch (icon) {
    case 'sun':
      return (
        <g>
          <circle cx="50" cy="50" r="18" fill="currentColor" stroke="none" opacity="0.95" />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * Math.PI) / 4;
            const x1 = 50 + Math.cos(angle) * 28;
            const y1 = 50 + Math.sin(angle) * 28;
            const x2 = 50 + Math.cos(angle) * 40;
            const y2 = 50 + Math.sin(angle) * 40;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
      );
    case 'moon':
      return (
        <path
          d="M62 22 a30 30 0 1 0 16 56 a26 26 0 0 1 -16 -56 z"
          fill="currentColor"
          stroke="none"
          opacity="0.95"
        />
      );
    case 'cloud-sun':
      return (
        <g>
          <circle cx="32" cy="36" r="12" fill="currentColor" stroke="none" opacity="0.9" />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1={32 + Math.cos(angle) * 16}
                y1={36 + Math.sin(angle) * 16}
                x2={32 + Math.cos(angle) * 22}
                y2={36 + Math.sin(angle) * 22}
              />
            );
          })}
          {cloudPath(58, 60, 0.9)}
        </g>
      );
    case 'cloud-moon':
      return (
        <g>
          <path
            d="M40 18 a18 18 0 1 0 12 32 a16 16 0 0 1 -12 -32 z"
            fill="currentColor"
            stroke="none"
            opacity="0.9"
          />
          {cloudPath(58, 64, 0.9)}
        </g>
      );
    case 'cloud':
      return cloudPath(50, 55, 1);
    case 'cloud-rain':
      return (
        <g>
          {cloudPath(50, 40, 0.9)}
          <line x1="36" y1="76" x2="32" y2="88" />
          <line x1="50" y1="76" x2="46" y2="88" />
          <line x1="64" y1="76" x2="60" y2="88" />
        </g>
      );
    case 'cloud-snow':
      return (
        <g>
          {cloudPath(50, 40, 0.9)}
          <circle cx="36" cy="84" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="50" cy="86" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="64" cy="84" r="2.5" fill="currentColor" stroke="none" />
        </g>
      );
    case 'cloud-fog':
      return (
        <g>
          {cloudPath(50, 36, 0.9)}
          <line x1="20" y1="74" x2="80" y2="74" />
          <line x1="26" y1="84" x2="74" y2="84" />
        </g>
      );
    case 'cloud-storm':
      return (
        <g>
          {cloudPath(50, 38, 0.9)}
          <polyline points="48,68 40,84 54,84 46,96" />
        </g>
      );
  }
}

function cloudPath(cx: number, cy: number, scale = 1): React.ReactElement {
  // A simple bumpy cloud built from three circles so the silhouette
  // matches the wireframe better than a single ellipse.
  const r1 = 14 * scale;
  const r2 = 18 * scale;
  const r3 = 12 * scale;
  return (
    <g>
      <circle
        cx={cx - 16 * scale}
        cy={cy}
        r={r1}
        fill="currentColor"
        stroke="none"
        opacity="0.95"
      />
      <circle cx={cx} cy={cy - 6 * scale} r={r2} fill="currentColor" stroke="none" opacity="0.95" />
      <circle
        cx={cx + 16 * scale}
        cy={cy}
        r={r3}
        fill="currentColor"
        stroke="none"
        opacity="0.95"
      />
      <ellipse
        cx={cx}
        cy={cy + 6 * scale}
        rx={26 * scale}
        ry={10 * scale}
        fill="currentColor"
        stroke="none"
        opacity="0.95"
      />
    </g>
  );
}
