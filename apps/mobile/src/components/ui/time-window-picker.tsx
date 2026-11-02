import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { haptics, useTheme } from '@/theme';

import { TimePicker } from './date-picker';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';
import {
  presetFor,
  TIME_WINDOW_PRESETS,
  timeWindowError,
  timeWindowLabel,
  type TimeWindow,
} from './time-window';

export type TimeWindowPickerProps = {
  label: string;
  value: TimeWindow;
  onChange: (value: TimeWindow) => void;
  /** Error from the form; the picker also shows its own (end before start). */
  error?: string;
};

/**
 * "When should the sitter arrive?": one tap on Morning / Midday / Afternoon /
 * Evening, or Custom for exact times. Times are the business's local time.
 */
export function TimeWindowPicker({ label, value, onChange, error }: TimeWindowPickerProps) {
  const theme = useTheme();
  const preset = presetFor(value);
  const [custom, setCustom] = useState(preset === null);
  const problem = error ?? (custom ? timeWindowError(value) : null);

  const chip = (key: string, text: string, selected: boolean, onPress: () => void) => (
    <PressableScale
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={text}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={[
        styles.chip,
        {
          minHeight: theme.size.tap,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.space.md,
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text variant="label" tone={selected ? 'onPrimary' : 'default'}>
        {text}
      </Text>
    </PressableScale>
  );

  return (
    <View style={{ gap: theme.space.xs }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text variant="label">{label}</Text>
      <View style={[styles.chips, { gap: theme.space.xs }]}>
        {TIME_WINDOW_PRESETS.map((p) =>
          chip(p.key, `${p.label}, ${timeWindowLabel(p)}`, !custom && preset?.key === p.key, () => {
            setCustom(false);
            onChange({ start: p.start, end: p.end });
          }),
        )}
        {chip('custom', 'Custom times', custom, () => setCustom(true))}
      </View>
      {!custom && preset ? (
        <Text variant="callout" tone="muted">
          Arrives {timeWindowLabel(preset)}
        </Text>
      ) : null}
      {custom ? (
        <View style={{ gap: theme.space.sm }}>
          <TimePicker
            label="Earliest arrival"
            value={value.start}
            onChange={(start) => onChange({ ...value, start })}
          />
          <TimePicker
            label="Latest arrival (optional)"
            value={value.end ?? ''}
            onChange={(end) => onChange({ ...value, end: end || null })}
            placeholder="Any time after"
          />
        </View>
      ) : null}
      {problem ? (
        <View style={[styles.row, { gap: theme.space.xxs }]}>
          <Icon name="info" size="sm" color="danger" />
          <Text
            variant="callout"
            tone="danger"
            accessibilityLiveRegion="polite"
            style={styles.flex}
          >
            {problem}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
