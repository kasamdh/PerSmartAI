import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/**
 * The tappable "field" that Select, DatePicker and TimePicker open from: looks
 * like a TextField, shows the current value, and has the error next to it.
 */
export function FieldButton({
  label,
  value,
  placeholder,
  error,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  icon: IconName;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.xxs + 2 }}>
      <Text variant="label">{label}</Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityHint={error}
        onPress={onPress}
        style={[
          styles.field,
          {
            minHeight: theme.size.control,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space.md,
            backgroundColor: theme.colors.surface,
            gap: theme.space.xs,
          },
        ]}
      >
        <Text variant="body" tone={value ? 'default' : 'muted'} style={styles.flex}>
          {value || placeholder}
        </Text>
        <Icon name={icon} color="textMuted" />
      </PressableScale>
      {error ? (
        <View style={[styles.row, { gap: theme.space.xxs }]}>
          <Icon name="info" size="sm" color="danger" />
          <Text
            variant="callout"
            tone="danger"
            accessibilityLiveRegion="polite"
            style={styles.flex}
          >
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
