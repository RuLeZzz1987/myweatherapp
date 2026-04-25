import { useTranslation } from 'react-i18next';

/**
 * Open-Meteo's free tier requires the "Weather data by Open-Meteo"
 * attribution under CC-BY 4.0. We surface it on every page.
 */
export function AttributionFooter() {
  const { t } = useTranslation();
  const href = t('footer.attributionLink');

  return (
    <footer className="mt-auto pt-12 text-center text-xs text-muted">
      <p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="underline-offset-2 hover:underline"
        >
          {t('footer.attribution')}
        </a>
      </p>
      <p className="mt-1">{t('footer.license')}</p>
    </footer>
  );
}
