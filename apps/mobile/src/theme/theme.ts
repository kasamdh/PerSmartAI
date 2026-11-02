import { contrastRatio, readableOn, textColorOn } from '@petsitter/shared/branding';

import { darkColors, lightColors, type ColorScheme, type Colors } from './colors';
import { elevation, motion, radius, size, space, type } from './tokens';

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  type: typeof type;
  motion: typeof motion;
  /** Soft shadow for cards and sheets at this level. */
  elevation: (level: 0 | 1 | 2 | 3) => ReturnType<typeof elevation>;
};

/**
 * The full theme for a color scheme. `brandPrimary` is the business's own primary
 * color (white-label); it replaces the teal in both modes, adjusted so text and
 * icons on it, and it on the screen, stay readable.
 */
export function buildTheme(scheme: ColorScheme, brandPrimary?: string | null): Theme {
  const base = scheme === 'dark' ? darkColors : lightColors;
  const colors = brandPrimary ? withBrand(base, brandPrimary, scheme) : base;
  return {
    scheme,
    colors,
    space,
    radius,
    size,
    type,
    motion,
    elevation: (level) => elevation(level, colors.shadow),
  };
}

function withBrand(base: Colors, brand: string, scheme: ColorScheme): Colors {
  // In dark mode a brand color is lightened until it stands out on the dark surface.
  const primary = scheme === 'dark' ? readableOn(brand, base.surface, 4.5) : brand;
  const onPrimary = textColorOn(primary);
  const ink = readableOn(brand, base.surface, 4.5);
  // The soft tint: the brand mixed into the surface.
  const primarySoft = mix(primary, base.surface, scheme === 'dark' ? 0.18 : 0.12);
  return {
    ...base,
    primary,
    onPrimary,
    primarySoft,
    primaryInk: contrastRatio(ink, primarySoft) >= 4.5 ? ink : readableOn(ink, primarySoft, 4.5),
  };
}

function mix(a: string, b: string, amountOfA: number): string {
  const ch = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return `#${x
    .map((v, i) => Math.round(v * amountOfA + y[i] * (1 - amountOfA)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}
