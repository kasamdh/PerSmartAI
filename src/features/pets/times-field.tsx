import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MIN_TAP_TARGET } from '@/components/big-button';

import { formatTimeOfDay, normalizeTime, normalizeTimes, TIME_PRESETS } from './logic';

type TimesFieldProps = {
  label: string;
  value: string[];
  onChange: (times: string[]) => void;
  error?: string;
};

/** Times of day: tap Morning/Midday/Evening/Bedtime, or add a specific time. */
export function TimesField({ label, value, onChange, error }: TimesFieldProps) {
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const times = normalizeTimes(value);

  const toggle = (time: string) =>
    onChange(
      times.includes(time) ? times.filter((t) => t !== time) : normalizeTimes([...times, time]),
    );

  const addCustom = () => {
    const t = normalizeTime(custom);
    if (!t) {
      setCustomError('Use a 24-hour time like 08:30 or 17:45');
      return;
    }
    setCustomError(null);
    setCustom('');
    onChange(normalizeTimes([...times, t]));
  };

  const presetTimes: string[] = TIME_PRESETS.map((p) => p.time);
  const otherTimes = times.filter((t) => !presetTimes.includes(t));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {TIME_PRESETS.map((p) => {
          const on = times.includes(p.time);
          return (
            <Pressable
              key={p.time}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${p.label}, ${formatTimeOfDay(p.time)}`}
              onPress={() => toggle(p.time)}
              style={[styles.chip, on && styles.on]}
            >
              <Text style={[styles.chipLabel, on && styles.onLabel]}>{p.label}</Text>
              <Text style={[styles.chipTime, on && styles.onLabel]}>{formatTimeOfDay(p.time)}</Text>
            </Pressable>
          );
        })}
        {otherTimes.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${formatTimeOfDay(t)}`}
            onPress={() => toggle(t)}
            style={[styles.chip, styles.on]}
          >
            <Text style={[styles.chipLabel, styles.onLabel]}>{formatTimeOfDay(t)} ✕</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.customRow}>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          placeholder="Other time, e.g. 15:30"
          placeholderTextColor="#8A8A8A"
          accessibilityLabel="Add another time"
          keyboardType="numbers-and-punctuation"
          onSubmitEditing={addCustom}
          style={styles.input}
        />
        <Pressable accessibilityRole="button" onPress={addCustom} style={styles.addButton}>
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>
      {customError || error ? <Text style={styles.error}>{customError ?? error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { borderColor: '#208AEF', backgroundColor: '#E3F0FD' },
  chipLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  chipTime: { fontSize: 13, color: '#555555' },
  onLabel: { color: '#0B5CAD' },
  customRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  addButton: {
    minHeight: MIN_TAP_TARGET,
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  error: { fontSize: 15, color: '#C62828' },
});
