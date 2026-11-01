import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform } from 'react-native';

import {
  dateFromString,
  formatDateLabel,
  formatTimeLabel,
  timeFromString,
  toDateString,
  toTimeString,
} from '@/lib/wall-clock';
import { useTheme } from '@/theme';

import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { FieldButton } from './field-button';
import { TextField } from './text-field';

type PickerProps = {
  label: string;
  /** "YYYY-MM-DD" (dates) or "HH:MM" (times); "" when not set. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  /** Earliest date ("YYYY-MM-DD"), dates only. */
  minimumDate?: string;
};

function NativePicker({ mode, ...props }: PickerProps & { mode: 'date' | 'time' }) {
  const { label, value, onChange, error, placeholder = 'Choose', minimumDate } = props;
  const theme = useTheme();
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
  const emit = (date: Date) => onChange(mode === 'date' ? toDateString(date) : toTimeString(date));

  const openPicker = () => {
    if (Platform.OS === 'android') {
      // Android's own dialog; nothing else to show.
      DateTimePickerAndroid.open({
        mode,
        value: initial,
        minimumDate: mode === 'date' ? min : undefined,
        onValueChange: (_event, date) => emit(date),
      });
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <FieldButton
        label={label}
        value={shown}
        placeholder={placeholder}
        error={error}
        icon={mode === 'date' ? 'calendar' : 'clock'}
        onPress={openPicker}
      />
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={<Button label="Done" onPress={() => setOpen(false)} />}
      >
        <DateTimePicker
          mode={mode}
          value={initial}
          minimumDate={mode === 'date' ? min : undefined}
          display={mode === 'date' ? 'inline' : 'spinner'}
          minuteInterval={mode === 'time' ? 5 : undefined}
          themeVariant={theme.scheme}
          accentColor={theme.colors.primary}
          onValueChange={(_event, date) => emit(date)}
        />
      </BottomSheet>
    </>
  );
}

/** A date field: Android's date dialog, or a calendar in a sheet on iPhone. */
export function DatePicker(props: PickerProps) {
  return <NativePicker mode="date" {...props} />;
}

/** A time field (5-minute steps), in the business's wall-clock time. */
export function TimePicker(props: Omit<PickerProps, 'minimumDate'>) {
  return <NativePicker mode="time" {...props} />;
}
