import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics, useTheme, type Colors } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  /**
   * primary: the one main action on a screen. secondary: an outlined alternative.
   * ghost: low-emphasis text action. danger: destructive (delete, cancel booking).
   */
  variant?: ButtonVariant;
  /** Shows a spinner, blocks presses and tells screen readers it's busy. */
  loading?: boolean;
  disabled?: boolean;
  /** Optional leading icon. */
  icon?: IconName;
  /** Stretch to the container width (default) or hug the label. */
  fullWidth?: boolean;
  /** Haptic feedback on press. */
  haptic?: 'tap' | 'success';
  /** Only when the visible label isn't enough (e.g. an arrow "›" means "Next month"). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const LOOK: Record<
  ButtonVariant,
  { background?: keyof Colors; border?: keyof Colors; text: keyof Colors }
> = {
  primary: { background: 'primary', text: 'onPrimary' },
  secondary: { border: 'primaryInk', text: 'primaryInk' },
  ghost: { text: 'primaryInk' },
  danger: { background: 'danger', text: 'onDanger' },
};

/** The app's button. At least 56 pt tall; text can grow and wrap. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const look = LOOK[variant];
  const blocked = disabled || loading;
  const textColor = theme.colors[look.text];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      hitSlop={4}
      testID={testID}
      onPress={() => {
        if (haptic) haptics[haptic]();
        onPress?.();
      }}
      style={[
        styles.base,
        {
          minHeight: theme.size.control,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.space.lg,
          backgroundColor: look.background ? theme.colors[look.background] : 'transparent',
          borderWidth: look.border ? 2 : 0,
          borderColor: look.border ? theme.colors[look.border] : 'transparent',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: blocked && !loading ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={[styles.row, { gap: theme.space.xs }]}>
          {icon ? <Icon name={icon} color={look.text} /> : null}
          <Text variant="button" align="center" style={{ color: textColor }}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
});
