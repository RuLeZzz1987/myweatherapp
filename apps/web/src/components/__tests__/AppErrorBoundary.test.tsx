import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from '../AppErrorBoundary';
import i18n, { setLanguage } from '../../i18n';
import { renderWithProviders } from '../../../test/render';

function Boom({ when }: { when: boolean }): React.ReactElement {
  if (when) throw new Error('kaboom');
  return <p>healthy child</p>;
}

describe('<AppErrorBoundary />', () => {
  // Sentry's ErrorBoundary lets React's normal `console.error` plumbing
  // run when a child throws. Silence it here so test output stays clean
  // — but keep the spy assertable so we can verify our own fallback's
  // logging path fires too.
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(async () => {
    consoleErrorSpy.mockClear();
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders children when no error is thrown', () => {
    renderWithProviders(
      <AppErrorBoundary>
        <Boom when={false} />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('healthy child')).toBeInTheDocument();
    expect(screen.queryByTestId('app-crash-fallback')).not.toBeInTheDocument();
  });

  it('renders the localized fallback when a child throws', () => {
    renderWithProviders(
      <AppErrorBoundary onReload={() => {}}>
        <Boom when />
      </AppErrorBoundary>,
    );

    const fallback = screen.getByTestId('app-crash-fallback');
    expect(fallback).toHaveAttribute('role', 'alert');
    expect(fallback).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Something went wrong/i);
    expect(screen.getByText(/MyWeather hit an unexpected problem/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/i })).toBeInTheDocument();
  });

  it('logs the error via console.error so it shows up in devtools', () => {
    renderWithProviders(
      <AppErrorBoundary onReload={() => {}}>
        <Boom when />
      </AppErrorBoundary>,
    );

    const ourLog = consoleErrorSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('[AppErrorBoundary]'),
    );
    expect(ourLog).toBeDefined();
  });

  it('invokes the reload callback when the user clicks Reload', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();

    renderWithProviders(
      <AppErrorBoundary onReload={onReload}>
        <Boom when />
      </AppErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: /Reload/i }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('translates the fallback when the active locale changes', async () => {
    // Use setLanguage (not changeLanguage) so the de catalog is loaded
    // before t() runs — see src/i18n/index.ts.
    await setLanguage('de');

    renderWithProviders(
      <AppErrorBoundary onReload={() => {}}>
        <Boom when />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Etwas ist schiefgelaufen/i,
    );
    expect(screen.getByRole('button', { name: /Neu laden/i })).toBeInTheDocument();
  });
});
