import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { TextField } from '@/components/text-field';
import { STATUS_LINE_MAX_LENGTH } from '@/features/visits/api';

export const STATUS_PRESETS = [
  'Out on a walk',
  'Feeding time',
  'Playing',
  'Cuddles on the couch',
  'Cleaning up',
  'Wrapping up',
];

/** The one line owners see live at the top of their visit screen. */
export function StatusLineEditor({
  value,
  onSave,
  saving,
}: {
  value: string | null;
  onSave: (text: string) => void;
  saving: boolean;
}) {
  const [custom, setCustom] = useState('');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tell the owner what’s happening</Text>
      <Text style={styles.current} accessibilityLiveRegion="polite">
        {value ? `Now showing: “${value}”` : 'Nothing showing yet.'}
      </Text>
      <View style={styles.chips}>
        {STATUS_PRESETS.map((preset) => {
          const selected = preset === value;
          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show “${preset}”`}
              disabled={saving}
              onPress={() => onSave(selected ? '' : preset)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{preset}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label="Or write your own"
        value={custom}
        onChangeText={setCustom}
        placeholder="e.g. Napping in the sun"
        maxLength={STATUS_LINE_MAX_LENGTH}
      />
      <BigButton
        label="Show it"
        variant="secondary"
        disabled={!custom.trim()}
        loading={saving}
        onPress={() => {
          onSave(custom);
          setCustom('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  current: { fontSize: 16, color: '#1B5E20' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#D6D6D6',
    justifyContent: 'center',
  },
  chipSelected: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  pressed: { opacity: 0.7 },
  chipLabel: { fontSize: 16, color: '#1A1A1A' },
  chipLabelSelected: { fontWeight: '700', color: '#1B5E20' },
});
