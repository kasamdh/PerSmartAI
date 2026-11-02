import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// Size, type, shape and motion tokens. Everything is on a 4 pt grid.

/** Spacing (4/8 pt grid). Use these for padding, margins and gaps. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Corner radius. Cards use `card` (20); pills use `pill`. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 20,
  sheet: 28,
  pill: 999,
} as const;

/** Touch sizes (points). Every tap target is at least `tap`. */
export const size = {
  /** Minimum tap target for anything tappable. */
  tap: 48,
  /** Standard button / input height. */
  control: 56,
  /** Sitter care buttons: thumb-sized while holding a leash. */
  bigAction: 88,
  icon: { sm: 18, md: 22, lg: 28, xl: 40 },
  avatar: { sm: 40, md: 56, lg: 80 },
} as const;

/**
 * Type scale (system font: San Francisco / Roboto). Every style scales with the
 * phone's text size; `maxScale` caps the largest steps so big headings and tight
 * UI (tab labels, chips) don't break layouts, while body text still grows a lot.
 */
export type TypeVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'callout'
  | 'caption'
  | 'label'
  | 'button';

export const type: Record<TypeVariant, TextStyle & { maxScale: number }> = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.4, maxScale: 1.4 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3, maxScale: 1.5 },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.2, maxScale: 1.6 },
  subheading: { fontSize: 18, lineHeight: 24, fontWeight: '600', maxScale: 1.8 },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400', maxScale: 2 },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600', maxScale: 2 },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '400', maxScale: 2 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500', maxScale: 1.8 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', maxScale: 1.6 },
  button: { fontSize: 17, lineHeight: 22, fontWeight: '600', maxScale: 1.6 },
};

/** Soft elevation. Pass the theme's shadow color. */
export function elevation(level: 0 | 1 | 2 | 3, shadowColor: string): ViewStyle {
  if (level === 0) return {};
  const y = [0, 2, 6, 12][level];
  const blur = [0, 8, 18, 28][level];
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor,
      shadowOffset: { width: 0, height: y },
      shadowOpacity: 1,
      shadowRadius: blur / 2,
    },
    default: { elevation: [0, 2, 4, 8][level], shadowColor },
  });
}

/** Motion: short and soft. Reduce Motion turns movement into simple fades or nothing. */
export const motion = {
  fast: 150,
  base: 200,
  slow: 250,
  /** Springy press feedback. */
  spring: { damping: 18, stiffness: 320, mass: 0.6 },
  pressedScale: 0.97,
  /** How long a toast with Undo stays (ms). */
  toastMs: 5000,
} as const;
