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
    renderWithProviders(<LiveRegion cityLabel={null} status="idle" />);
    expect(screen.getByTestId('live-region')).toHaveTextContent('');
  });

  it('announces a localized loading message', () => {
    renderWithProviders(<LiveRegion cityLabel="Oslo, Norway" status="loading" />);
    expect(screen.getByTestId('live-region')).toHaveTextContent(/Loading weather for Oslo/i);
  });

  it('announces a localized success message', () => {
    const { rerender } = renderWithProviders(
      <LiveRegion cityLabel="Oslo, Norway" status="success" />,
    );
    expect(screen.getByTestId('live-region')).toHaveTextContent(/updated/i);

    rerender(<LiveRegion cityLabel="Oslo, Norway" status="success" />);
    expect(screen.getByTestId('live-region')).toHaveTextContent(/updated/i);
  });

  it('remounts when the parent supplies a new key (re-announces identical text)', () => {
    // Re-announce semantics live in the parent; LiveRegion itself is
    // a plain rendering component. We model the parent contract here.
    const { rerender, getByTestId } = renderWithProviders(
      <LiveRegion key="success:1" cityLabel="Oslo, Norway" status="success" />,
    );
    const first = getByTestId('live-region');
    expect(first).toHaveTextContent(/updated/i);

    rerender(<LiveRegion key="success:2" cityLabel="Oslo, Norway" status="success" />);
    const second = getByTestId('live-region');
    expect(second).toHaveTextContent(/updated/i);
    expect(second).not.toBe(first);
  });

  it('announces a localized error message', () => {
    renderWithProviders(<LiveRegion cityLabel="Oslo, Norway" status="error" />);
    expect(screen.getByTestId('live-region')).toHaveTextContent(/Couldn't load weather for Oslo/i);
  });
});
