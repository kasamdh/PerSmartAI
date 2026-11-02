import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { haptics, useTheme, type Colors } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type SwipeAction = {
  label: string;
  icon: IconName;
  tone: 'primary' | 'danger';
  onPress: () => void;
};

export type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Avatar, icon or chip on the left. */
  leading?: ReactNode;
  /** 'chevron' for rows that open something, or any node (a value, a chip). */
  trailing?: 'chevron' | ReactNode;
  onPress?: () => void;
  /** Defaults to "title, subtitle". */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /**
   * Swipe left to reveal these. They're also offered to screen readers as actions,
   * so nobody needs to swipe.
   */
  swipeActions?: SwipeAction[];
};

/** A 64 pt row for lists: leading, title + subtitle, trailing. */
export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  swipeActions,
}: ListItemProps) {
  const theme = useTheme();
  const label = accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title);

  const content = (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      pressedScale={0.99}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityActions={swipeActions?.map((a) => ({ name: a.label, label: a.label }))}
      onAccessibilityAction={(event) =>
        swipeActions?.find((a) => a.label === event.nativeEvent.actionName)?.onPress()
      }
      style={[
        styles.row,
        {
          minHeight: 64,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
          gap: theme.space.sm,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {leading}
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="callout" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing === 'chevron' ? <Icon name="chevronRight" color="textMuted" /> : trailing}
    </PressableScale>
  );

  if (!swipeActions?.length) return content;

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(_progress, _translation, swipeable) => (
        <View style={styles.actions}>
          {swipeActions.map((action) => {
            const bg: keyof Colors = action.tone === 'danger' ? 'danger' : 'primary';
            const fg: keyof Colors = action.tone === 'danger' ? 'onDanger' : 'onPrimary';
            return (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => {
                  haptics.tap();
                  swipeable.close();
                  action.onPress();
                }}
                style={[styles.action, { backgroundColor: theme.colors[bg], minWidth: 84, gap: 4 }]}
              >
                <Icon name={action.icon} color={fg} />
                <Text variant="caption" style={{ color: theme.colors[fg] }}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {content}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row' },
  action: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
