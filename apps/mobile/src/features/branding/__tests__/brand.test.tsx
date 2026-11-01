import { brandPalette } from '@petsitter/shared/branding';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BigButton } from '@/components/big-button';

import { BrandContext } from '../brand-context';

const style = (label: string) =>
  StyleSheet.flatten(screen.getByRole('button', { name: label }).props.style);

describe('white-label BigButton', () => {
  it('uses the default color before a business is known', async () => {
    await render(<BigButton label="Sign in" />);
    expect(style('Sign in').backgroundColor).toBe(brandPalette({}).primary);
  });

  it("uses the business's color with readable text", async () => {
    const colors = brandPalette({ primaryColor: '#FFD84D', accentColor: '#0E7C66' });
    await render(
      <BrandContext.Provider value={{ colors, name: 'Happy Paws', logoUrl: null }}>
        <BigButton label="Check in" />
        <BigButton label="Details" variant="secondary" />
      </BrandContext.Provider>,
    );
    expect(style('Check in').backgroundColor).toBe('#FFD84D');
    expect(StyleSheet.flatten(screen.getByText('Check in').props.style).color).toBe('#111111');
    expect(style('Details').borderColor).toBe(colors.primaryOnWhite);
  });
});
