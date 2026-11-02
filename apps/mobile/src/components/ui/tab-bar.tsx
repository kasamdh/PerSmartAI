import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { haptics, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export const MAX_TABS = 5;

/**
 * The bottom tab bar: icon with a label under it, the selected tab on a soft pill,
 * at most 5 tabs. Use as `<Tabs tabBar={(p) => <TabBar {...p} icons={...} />}>`.
 */
export function TabBar({
  state,
  descriptors,
  navigateToTab,
  insets,
  icons,
}: BottomTabBarProps & { icons: Record<string, IconName> }) {
  const theme = useTheme();
  if (__DEV__ && state.routes.length > MAX_TABS) {
    console.warn(`TabBar: ${state.routes.length} tabs; the design system allows ${MAX_TABS}.`);
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: Math.max(insets.bottom, theme.space.xs),
          paddingTop: theme.space.xs,
          paddingHorizontal: theme.space.xs,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : (options.title ?? route.name);
        const badge = options.tabBarBadge;
        return (
          <PressableScale
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={
              options.tabBarAccessibilityLabel ?? (badge ? `${label}, ${badge} new` : label)
            }
            onPress={() => {
              if (!focused) {
                haptics.tap();
                navigateToTab(route.key);
              }
            }}
            style={[styles.tab, { minHeight: theme.size.control, gap: 2 }]}
          >
            <View
              style={[
                styles.pill,
                {
                  backgroundColor: focused ? theme.colors.primarySoft : 'transparent',
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              <Icon
                name={icons[route.name] ?? 'paw'}
                color={focused ? 'primaryInk' : 'textMuted'}
              />
              {badge !== undefined ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.danger, borderColor: theme.colors.surface },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{ color: theme.colors.onDanger, fontSize: 11, lineHeight: 14 }}
                    maxFontSizeMultiplier={1.2}
                  >
                    {String(badge)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              variant="caption"
              tone={focused ? 'primary' : 'muted'}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={focused ? styles.focused : undefined}
            >
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 16, paddingVertical: 4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  focused: { fontWeight: '700' },
});
