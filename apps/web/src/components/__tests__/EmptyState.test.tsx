import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EmptyState } from '../EmptyState';
import i18n from '../../i18n';
import { renderWithProviders } from '../../../test/render';

describe('<EmptyState />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the localized heading and prompt', () => {
    renderWithProviders(<EmptyState />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Find the weather/i);
    expect(screen.getByText(/Search for a city to see/i)).toBeInTheDocument();
  });
});
