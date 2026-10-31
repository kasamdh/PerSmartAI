import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={8}
      style={(state) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        state.pressed && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : '#208AEF'} />
      ) : (
        <Text style={[styles.label, !isPrimary && styles.secondaryLabel]}>{label}</Text>
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
  primary: {
    backgroundColor: '#208AEF',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#208AEF',
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
    color: '#FFFFFF',
  },
  secondaryLabel: {
    color: '#208AEF',
  },
});
