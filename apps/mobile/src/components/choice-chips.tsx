import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TAP_TARGET } from './big-button';

type ChoiceChipsProps<T extends string> = {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
};

/** Large single-choice buttons (radio group), easier one-handed than a dropdown. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: ChoiceChipsProps<T>) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={label ? `${label}: ${o.label}` : o.label}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && styles.selected]}
            >
              <Text style={[styles.chipLabel, selected && styles.selectedLabel]}>{o.label}</Text>
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
  selected: { borderColor: '#1565C0', backgroundColor: '#E3F0FD' },
  chipLabel: { fontSize: 17, color: '#1A1A1A' },
  selectedLabel: { fontWeight: '700', color: '#0B5CAD' },
  error: { fontSize: 15, color: '#C62828' },
});
