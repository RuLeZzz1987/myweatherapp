import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorState } from '../ErrorState';
import { ApiError } from '../../lib/api/client';
import i18n from '../../i18n';
import { renderWithProviders } from '../../../test/render';

describe('<ErrorState />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the localized error heading and a retry button', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderWithProviders(
      <ErrorState
        error={new ApiError('Open-Meteo unavailable', 503, 'upstream_unavailable')}
        online
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Couldn't load/i);
    expect(screen.getByText(/503/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the offline hint when offline', () => {
    renderWithProviders(<ErrorState error={new Error('boom')} online={false} onRetry={() => {}} />);
    expect(screen.getByText(/Check your connection/i)).toBeInTheDocument();
  });

  it('hides the offline hint when online', () => {
    renderWithProviders(<ErrorState error={new Error('boom')} online onRetry={() => {}} />);
    expect(screen.queryByText(/Check your connection/i)).not.toBeInTheDocument();
  });

  it('announces the error politely with cityLabel', () => {
    renderWithProviders(
      <ErrorState error={new Error('boom')} online onRetry={() => {}} cityLabel="Oslo, Norway" />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Couldn't load weather for Oslo/i);
  });
});
