// White-label colors. Businesses pick a primary and an accent color in the admin
// web app; the mobile app uses them for buttons, headers and tabs. These helpers
// keep text readable whatever colors are chosen (WCAG contrast).

export const DEFAULT_PRIMARY = '#208AEF';
export const DEFAULT_ACCENT = '#0B5CAD';

const DARK_TEXT = '#111111';
const LIGHT_TEXT = '#FFFFFF';
const WHITE = '#FFFFFF';

/** WCAG AA for large text and UI parts (buttons, icons). */
export const MIN_UI_CONTRAST = 3;
/** WCAG AA for body text. */
export const MIN_TEXT_CONTRAST = 4.5;

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near-black, whichever reads better on `background`. */
export function textColorOn(background: string): string {
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT;
}

/** Mixes `hex` toward black by `amount` (0..1). */
export function darken(hex: string, amount: number): string {
  return toHex(channels(hex).map((c) => c * (1 - amount)) as [number, number, number]);
}

/** `hex` darkened just enough to reach `min` contrast on white (for text and tints). */
export function readableOnWhite(hex: string, min = MIN_TEXT_CONTRAST): string {
  let color = hex;
  for (let step = 1; contrastRatio(color, WHITE) < min && step <= 20; step++) {
    color = darken(hex, step * 0.05);
  }
  return color;
}

export type BrandPalette = {
  /** Button and header background. */
  primary: string;
  /** Text and icons on `primary`. */
  onPrimary: string;
  /** Primary as text or outline on white (secondary buttons, links). */
  primaryOnWhite: string;
  accent: string;
  onAccent: string;
  /** Accent as text or a tint on white (active tabs). */
  accentOnWhite: string;
};

export function brandPalette(colors: {
  primaryColor?: string | null;
  accentColor?: string | null;
}): BrandPalette {
  const primary = isHexColor(colors.primaryColor)
    ? colors.primaryColor.toUpperCase()
    : DEFAULT_PRIMARY;
  const accent = isHexColor(colors.accentColor) ? colors.accentColor.toUpperCase() : DEFAULT_ACCENT;
  return {
    primary,
    onPrimary: textColorOn(primary),
    primaryOnWhite: readableOnWhite(primary, MIN_UI_CONTRAST),
    accent,
    onAccent: textColorOn(accent),
    accentOnWhite: readableOnWhite(accent),
  };
}

/** Storage path for a new logo: `{org}/branding/logo-{stamp}.{ext}` (new name busts caches). */
export function logoPath(orgId: string, extension: 'png' | 'jpg' | 'webp', stamp: number): string {
  return `${orgId}/branding/logo-${stamp}.${extension}`;
}
