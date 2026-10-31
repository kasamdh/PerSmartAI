import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

// 56pt min height: comfortably above the 44pt/48dp platform minimums, for one-handed use.
export const MIN_TAP_TARGET = 56;

type BigButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
};

export function BigButton({ label, style, ...rest }: BigButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      style={(state) => [
        styles.button,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP_TARGET,
    borderRadius: 14,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
