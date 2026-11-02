import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only buttons need words for screen readers. */
  accessibilityLabel: string;
  onPress: () => void;
  /** A count shown on the icon (e.g. unread messages). Hidden at 0. */
  badge?: number;
  tone?: 'default' | 'primary';
};

/** A round 48 pt icon button, for header actions like Messages or Profile. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  badge = 0,
  tone = 'default',
}: IconButtonProps) {
  const theme = useTheme();
  const shown = badge > 99 ? '99+' : String(badge);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${accessibilityLabel}, ${shown} new` : accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={[
        styles.button,
        {
          width: theme.size.tap,
          height: theme.size.tap,
          borderRadius: theme.radius.pill,
          backgroundColor: tone === 'primary' ? theme.colors.primarySoft : theme.colors.surface,
        },
        theme.scheme === 'dark'
          ? { borderWidth: 1, borderColor: theme.colors.border }
          : theme.elevation(1),
      ]}
    >
      <Icon name={icon} color={tone === 'primary' ? 'primaryInk' : 'text'} />
      {badge > 0 ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.colors.danger, borderColor: theme.colors.background },
          ]}
        >
          <Text
            variant="caption"
            maxFontSizeMultiplier={1.2}
            style={[styles.badgeText, { color: theme.colors.onDanger }]}
          >
            {shown}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
