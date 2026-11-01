import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TAP_TARGET } from './big-button';

type MultiChoiceChipsProps<T extends string> = {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  error?: string;
};

/** Large toggle buttons for picking several options (checkbox group). */
export function MultiChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: MultiChoiceChipsProps<T>) {
  const toggle = (option: T) =>
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : options.map((o) => o.value).filter((v) => v === option || value.includes(v)),
    );

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row} accessibilityLabel={label}>
        {options.map((o) => {
          const selected = value.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={label ? `${label}: ${o.label}` : o.label}
              onPress={() => toggle(o.value)}
              style={[styles.chip, selected && styles.selected]}
            >
              <Text style={[styles.chipLabel, selected && styles.selectedLabel]}>
                {selected ? `✓ ${o.label}` : o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: MIN_TAP_TARGET,
    minWidth: 72,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: '#208AEF', backgroundColor: '#E3F0FD' },
  chipLabel: { fontSize: 17, color: '#1A1A1A' },
  selectedLabel: { fontWeight: '700', color: '#0B5CAD' },
  error: { fontSize: 15, color: '#C62828' },
});
