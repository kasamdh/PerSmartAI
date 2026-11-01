import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dateFromString,
  formatDateLabel,
  formatTimeLabel,
  timeFromString,
  toDateString,
  toTimeString,
} from '@/lib/wall-clock';

import { MIN_TAP_TARGET } from './big-button';
import { TextButton } from './form-screen';
import { TextField } from './text-field';

type DateTimeFieldProps = {
  label: string;
  mode: 'date' | 'time';
  /** "YYYY-MM-DD" for dates, "HH:MM" for times, or "" when not set. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Shown when there's no value, e.g. "Not set". */
  placeholder?: string;
  /** Earliest selectable date ("YYYY-MM-DD"). */
  minimumDate?: string;
  /** Offer a Clear button for optional fields. */
  clearable?: boolean;
};

/**
 * A large field that opens the platform's date or time picker: a dialog on
 * Android, an inline spinner with Done on iOS. Web has no native picker, so it
 * falls back to typing.
 */
export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  error,
  placeholder = 'Choose',
  minimumDate,
  clearable = false,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        error={error}
        placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:MM'}
      />
    );
  }

  const parsed = mode === 'date' ? dateFromString(value) : timeFromString(value);
  const shown = parsed ? (mode === 'date' ? formatDateLabel(value) : formatTimeLabel(value)) : '';
  const min = minimumDate ? (dateFromString(minimumDate) ?? undefined) : undefined;
  const initial = parsed ?? (mode === 'date' ? (min ?? new Date()) : timeFromString('09:00')!);

  const pick = (date: Date) => {
    onChange(mode === 'date' ? toDateString(date) : toTimeString(date));
    if (Platform.OS === 'android') setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown || placeholder}`}
        accessibilityHint={error}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [
          styles.input,
          !!error && styles.inputError,
          pressed && styles.pressed,
        ]}
      >
        <Text style={shown ? styles.value : styles.placeholder}>{shown || placeholder}</Text>
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {clearable && value !== '' ? <TextButton label="Clear" onPress={() => onChange('')} /> : null}

      {open ? (
        <>
          <DateTimePicker
            mode={mode}
            value={initial}
            minimumDate={mode === 'date' ? min : undefined}
            display={Platform.OS === 'ios' ? (mode === 'date' ? 'inline' : 'spinner') : 'default'}
            minuteInterval={mode === 'time' ? 5 : undefined}
            onValueChange={(_event, date) => pick(date)}
            onDismiss={() => setOpen(false)}
          />
          {Platform.OS === 'ios' ? (
            <TextButton label="Done" onPress={() => setOpen(false)} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  input: {
    minHeight: MIN_TAP_TARGET,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: '#C62828' },
  pressed: { backgroundColor: '#E3F0FD' },
  value: { fontSize: 18, color: '#1A1A1A' },
  placeholder: { fontSize: 18, color: '#8A8A8A' },
  error: { fontSize: 15, color: '#C62828' },
});
