import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UnitsToggle } from '../UnitsToggle';
import { PREFS_STORAGE_KEY, usePrefs } from '../../store/prefs';
import { renderWithProviders } from '../../../test/render';

describe('<UnitsToggle />', () => {
  beforeEach(() => {
    usePrefs.setState({ units: 'metric', languageOverride: null });
    localStorage.removeItem(PREFS_STORAGE_KEY);
  });
  afterEach(() => {
    usePrefs.setState({ units: 'metric', languageOverride: null });
    localStorage.removeItem(PREFS_STORAGE_KEY);
  });

  it('renders as a switch with both unit glyphs', () => {
    renderWithProviders(<UnitsToggle />);

    const sw = screen.getByRole('switch', { name: 'Units' });
    expect(sw).toHaveAttribute('aria-checked', 'false'); // metric default
    expect(sw).toHaveTextContent('°C');
    expect(sw).toHaveTextContent('°F');
  });

  it('toggles to imperial on click and reflects in aria-checked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnitsToggle />);

    const sw = screen.getByRole('switch', { name: 'Units' });
    await user.click(sw);

    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(usePrefs.getState().units).toBe('imperial');
  });

  it('flips back to metric on a second click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnitsToggle />);

    const sw = screen.getByRole('switch', { name: 'Units' });
    await user.click(sw);
    await user.click(sw);

    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(usePrefs.getState().units).toBe('metric');
  });
});
