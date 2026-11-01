import { brandPalette, contrastRatio } from '@petsitter/shared/branding';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BigButton } from '@/components/big-button';
import { lightColors, ThemeProvider } from '@/theme';

import { BrandContext } from '../brand-context';

const style = (label: string) =>
  StyleSheet.flatten(screen.getByRole('button', { name: label }).props.style);

describe('white-label buttons', () => {
  it('use the design system teal before a business is known', async () => {
    await render(
      <ThemeProvider>
        <BigButton label="Sign in" />
      </ThemeProvider>,
    );
    expect(style('Sign in').backgroundColor).toBe(lightColors.primary);
  });

  it("use the business's color with readable text", async () => {
    await render(
      <BrandContext.Provider
        value={{
          colors: brandPalette({ primaryColor: '#FFD84D' }),
          name: 'Happy Paws',
          logoUrl: null,
          customPrimary: '#FFD84D',
        }}
      >
        <ThemeProvider>
          <BigButton label="Check in" />
          <BigButton label="Details" variant="secondary" />
        </ThemeProvider>
      </BrandContext.Provider>,
    );
    expect(style('Check in').backgroundColor).toBe('#FFD84D');
    const label = StyleSheet.flatten(screen.getByText('Check in').props.style);
    expect(contrastRatio(label.color, '#FFD84D')).toBeGreaterThanOrEqual(4.5);
    // The outline uses the brand darkened enough to read on white.
    expect(contrastRatio(style('Details').borderColor as string, '#FFFFFF')).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
