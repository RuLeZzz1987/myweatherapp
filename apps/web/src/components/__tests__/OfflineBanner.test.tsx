import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OfflineBanner } from '../OfflineBanner';
import i18n from '../../i18n';
import { renderWithProviders } from '../../../test/render';

describe('<OfflineBanner />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders nothing when online', () => {
    const { container } = renderWithProviders(<OfflineBanner online={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the localized offline string when offline', () => {
    renderWithProviders(<OfflineBanner online={false} />);
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(/offline/i);
  });
});
