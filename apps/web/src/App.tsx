import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppHeader } from './components/AppHeader';
import type { GeocodeResult } from './lib/api/types';

/**
 * Step 6b shell — the wireframe's three zones are now in place:
 *   1. AppHeader (brand + units toggle + language picker + search)
 *   2. Hero (currently the empty state from SPEC §5.6 — "Search for a
 *      city to see the weather"; the real CurrentWeatherHero, the
 *      WeatherIllustration, and the Recent Searches strip land in §10
 *      step 7)
 *   3. AttributionFooter
 *
 * Selecting a city from the SearchBar bubbles up here so we can show
 * the chosen name in the hero (proof that the wiring works end-to-end);
 * the actual `useWeather` query and rendering arrive in §10 step 7.
 */
function App() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<GeocodeResult | null>(null);

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-12 px-6 py-6">
      <AppHeader onCitySelect={setSelected} />

      <section className="flex flex-1 flex-col items-center justify-center text-center">
        {selected ? (
          <>
            <h2 className="text-3xl font-light">{selected.name}</h2>
            <p className="mt-2 text-muted">
              {selected.country}
              {selected.admin1 ? ` · ${selected.admin1}` : ''}
            </p>
            <p className="mt-8 text-sm text-muted">
              {/* Hero comes online in §10 step 7 — for now just confirm the
                  selection round-tripped. */}
              {t('app.tagline')}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl">{t('app.greeting')}</h2>
            <p className="mt-2 text-muted">{t('app.tagline')}</p>
            <p className="mt-8 text-muted">{t('empty.prompt')}</p>
          </>
        )}
      </section>

      <footer className="text-center text-xs text-muted">
        <small>{t('footer.attribution')}</small>
      </footer>
    </main>
  );
}

export default App;
