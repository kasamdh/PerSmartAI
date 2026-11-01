import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type EmptyStateProps = {
  /** The illustration's main icon. */
  icon?: IconName;
  title: string;
  /** One or two friendly sentences on what goes here and why. */
  body?: string;
  /** The one clear next step. */
  action?: { label: string; onPress: () => void };
};

/**
 * What a list shows when it's empty: a soft illustration, a friendly line, and one
 * action. Never a blank screen.
 */
export function EmptyState({ icon = 'paw', title, body, action }: EmptyStateProps) {
  const theme = useTheme();
  const size = 132;
  return (
    <View
      style={[
        styles.wrap,
        { gap: theme.space.md, paddingVertical: theme.space.xl, paddingHorizontal: theme.space.md },
      ]}
    >
      <View
        style={{ width: size, height: size }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={size} height={size} viewBox="0 0 132 132">
          <Circle cx="66" cy="66" r="60" fill={theme.colors.primarySoft} />
          <Circle cx="112" cy="30" r="8" fill={theme.colors.accent} opacity={0.85} />
          <Circle cx="22" cy="98" r="5" fill={theme.colors.accent} opacity={0.6} />
          <Circle cx="104" cy="106" r="4" fill={theme.colors.primary} opacity={0.35} />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name={icon} size={52} color="primaryInk" />
        </View>
      </View>
      <View style={[styles.center, { gap: theme.space.xxs }]}>
        <Text variant="heading" align="center" accessibilityRole="header">
          {title}
        </Text>
        {body ? (
          <Text variant="body" tone="muted" align="center">
            {body}
          </Text>
        ) : null}
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
