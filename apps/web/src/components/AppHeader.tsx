import { useTranslation } from 'react-i18next';

import type { GeocodeResult } from '../lib/api/types';
import { LanguagePicker } from './LanguagePicker';
import { SearchBar } from './SearchBar';
import { UnitsToggle } from './UnitsToggle';

/**
 * AppHeader — the wireframe's top row, see SPEC.md §5.1.
 *
 * Layout, by breakpoint (SPEC §5.4):
 *   - <sm: brand + controls on row 1, search full-width on row 2.
 *   - sm–lg / ≥lg: brand left, controls + search right on a single row.
 *
 * The header is the only interactive surface on first load; everything
 * else is empty-state copy until the user picks a city.
 */

export interface AppHeaderProps {
  onCitySelect: (result: GeocodeResult) => void;
}

export function AppHeader({ onCitySelect }: AppHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
      <h1 className="text-xl font-medium">{t('brand')}</h1>

      <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1 sm:max-w-sm">
        <SearchBar onSelect={onCitySelect} />
      </div>

      <div className="order-2 flex items-center gap-3 sm:order-3">
        <UnitsToggle />
        <LanguagePicker />
      </div>
    </header>
  );
}
