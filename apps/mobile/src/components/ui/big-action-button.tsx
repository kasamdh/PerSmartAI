import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type BigActionButtonProps = {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Filled look for "on" states (e.g. a walk in progress, already fed). */
  active?: boolean;
  /** A short second line, e.g. "12 min" or "2× today". */
  detail?: string;
  /** Full sentence for screen readers, e.g. "Fed Max, ate all". */
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The sitter's care tap: thumb-sized (88 pt), icon over label, haptic on press.
 * Put two per row in a grid so they're easy to hit with one hand.
 */
export function BigActionButton({
  label,
  icon,
  onPress,
  active = false,
  detail,
  accessibilityLabel,
  disabled = false,
  style,
}: BigActionButtonProps) {
  const theme = useTheme();
  const fg = active ? 'onPrimary' : 'primaryInk';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      pressedScale={0.94}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={[
        styles.base,
        {
          minHeight: theme.size.bigAction,
          borderRadius: theme.radius.card,
          padding: theme.space.sm,
          gap: theme.space.xxs,
          backgroundColor: active ? theme.colors.primary : theme.colors.primarySoft,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size="lg" color={fg} />
      <View style={styles.text}>
        <Text variant="label" align="center" tone={active ? 'onPrimary' : 'primary'}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" align="center" tone={active ? 'onPrimary' : 'primary'}>
            {detail}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center' },
});
