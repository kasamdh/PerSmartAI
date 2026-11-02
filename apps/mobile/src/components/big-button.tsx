import type { StyleProp, ViewStyle } from 'react-native';

import { size } from '@/theme';

import { Button } from './ui/button';

// 56 pt: comfortably above the 48 pt minimum, for one-handed use.
export const MIN_TAP_TARGET = size.control;

type BigButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * The original full-width button, now drawn by the design system's Button so
 * every existing screen gets the new look. New screens use Button from
 * '@/components/ui' directly.
 */
export function BigButton({ variant = 'primary', ...props }: BigButtonProps) {
  return <Button variant={variant} {...props} />;
}
