import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type Colors, type TypeVariant } from '@/theme';

export type TextTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'allergy'
  | 'onPrimary'
  | 'onAllergy';

const TONE: Record<TextTone, keyof Colors> = {
  default: 'text',
  muted: 'textMuted',
  primary: 'primaryInk',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  allergy: 'allergy',
  onPrimary: 'onPrimary',
  onAllergy: 'onAllergy',
};

export type TextProps = RNTextProps & {
  /** Type scale step (display, title, heading, subheading, body, callout, caption, label). */
  variant?: TypeVariant;
  /** Color role; never pass raw colors. */
  tone?: TextTone;
  align?: 'auto' | 'left' | 'center' | 'right';
};

/**
 * All text in the app. Uses the type scale and theme colors, and grows with the
 * phone's text size (up to each step's limit, so layouts don't break).
 */
export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: TextProps) {
  const theme = useTheme();
  const { maxScale, ...typography } = theme.type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={maxScale}
      style={[typography, { color: theme.colors[TONE[tone]], textAlign: align }, style]}
      {...rest}
    />
  );
}
