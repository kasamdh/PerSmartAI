import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { useBrand } from '@/features/branding/brand-context';

// 56pt min height: comfortably above the 44pt/48dp platform minimums, for one-handed use.
export const MIN_TAP_TARGET = 56;

type BigButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  /** Shows a spinner and disables the button. */
  loading?: boolean;
};

export function BigButton({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...rest
}: BigButtonProps) {
  const isDisabled = !!disabled || loading;
  const isPrimary = variant === 'primary';
  // White-label: the business's primary color (readable text is picked for it).
  const { colors } = useBrand();
  const tone = isPrimary
    ? { backgroundColor: colors.primary }
    : { backgroundColor: '#FFFFFF', borderColor: colors.primaryOnWhite };
  const labelColor = isPrimary ? colors.onPrimary : colors.primaryOnWhite;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={8}
      style={(state) => [
        styles.button,
        !isPrimary && styles.secondary,
        tone,
        state.pressed && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP_TARGET,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondary: {
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
  },
});
