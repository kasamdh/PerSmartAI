import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';

export type CardProps = {
  children: ReactNode;
  /** Makes the whole card tappable. Then `accessibilityLabel` is required. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Inner padding token (default md = 16). */
  padding?: 'sm' | 'md' | 'lg';
  /** Soft shadow level (default 1). Dark mode uses a border instead. */
  elevation?: 0 | 1 | 2;
  /** A tinted card (e.g. "happening now"). */
  tone?: 'default' | 'primary';
  style?: StyleProp<ViewStyle>;
};

/** A rounded surface (20 pt corners) for grouping related content. */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padding = 'md',
  elevation = 1,
  tone = 'default',
  style,
}: CardProps) {
  const theme = useTheme();
  const surface: ViewStyle = {
    backgroundColor: tone === 'primary' ? theme.colors.primarySoft : theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.space[padding],
    gap: theme.space.sm,
    ...(theme.scheme === 'dark'
      ? { borderWidth: 1, borderColor: theme.colors.border }
      : theme.elevation(elevation)),
  };

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={[surface, style]}
      >
        {children}
      </PressableScale>
    );
  }
  return <View style={[surface, style]}>{children}</View>;
}
