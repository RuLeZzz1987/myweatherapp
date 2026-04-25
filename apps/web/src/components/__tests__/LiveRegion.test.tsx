import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LiveRegion } from '../LiveRegion';
import i18n from '../../i18n';
import { renderWithProviders } from '../../../test/render';

describe('<LiveRegion />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders nothing while idle', () => {
    renderWithProviders(<LiveRegion cityLabel={null} status="idle" tick={0} />);
    expect(screen.getByTestId('live-region')).toHaveTextContent('');
  });

  it('announces a localized loading message', () => {
    renderWithProviders(<LiveRegion cityLabel="Oslo, Norway" status="loading" tick={0} />);
    expect(screen.getByTestId('live-region')).toHaveTextContent(/Loading weather for Oslo/i);
  });

  it('announces a localized success message and re-renders when the tick changes', () => {
    const { rerender } = renderWithProviders(
      <LiveRegion cityLabel="Oslo, Norway" status="success" tick={1} />,
    );
    expect(screen.getByTestId('live-region')).toHaveTextContent(/updated/i);

    rerender(<LiveRegion cityLabel="Oslo, Norway" status="success" tick={2} />);
    expect(screen.getByTestId('live-region')).toHaveTextContent(/updated/i);
  });

  it('announces a localized error message', () => {
    renderWithProviders(<LiveRegion cityLabel="Oslo, Norway" status="error" tick={0} />);
    expect(screen.getByTestId('live-region')).toHaveTextContent(/Couldn't load weather for Oslo/i);
  });
});
