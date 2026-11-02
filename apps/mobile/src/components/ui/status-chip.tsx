import { StyleSheet, View } from 'react-native';

import { STATUS_LOOK, useTheme, type StatusIcon, type VisitStatus } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

const ICON: Record<StatusIcon, IconName> = {
  clock: 'clock',
  car: 'car',
  mapPin: 'mapPin',
  paw: 'paw',
  check: 'check',
  alert: 'alert',
  ban: 'ban',
};

export type StatusChipProps = {
  status: VisitStatus;
  /** Override the words (e.g. "Late · 12 min"); the color and icon stay. */
  label?: string;
};

/** A visit's status as color + icon + words, never color alone. */
export function StatusChip({ status, label }: StatusChipProps) {
  const theme = useTheme();
  const look = STATUS_LOOK[status];
  const text = label ?? look.label;
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${text}`}
      style={[
        styles.chip,
        {
          backgroundColor: theme.colors[look.background],
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.space.sm,
          gap: theme.space.xxs,
        },
      ]}
    >
      <Icon name={ICON[look.icon]} size="sm" color={look.foreground} />
      <Text variant="caption" style={{ color: theme.colors[look.foreground], fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 28,
    paddingVertical: 4,
  },
});
