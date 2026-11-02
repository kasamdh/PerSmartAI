import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /**
   * The screen's one main action (usually a primary Button), pinned to the
   * bottom thumb zone above the home indicator.
   */
  bottomAction?: ReactNode;
  /** Pull to refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Scroll the content (default) or lay it out yourself (lists that scroll). */
  scroll?: boolean;
  /** Safe-area edges to pad (default: all but the top, which the header covers). */
  edges?: Edge[];
};

/**
 * Every screen's frame: background, safe areas, keyboard avoidance, pull to
 * refresh, comfortable padding, and the main action in the thumb zone.
 */
export function Screen({
  children,
  bottomAction,
  refreshing = false,
  onRefresh,
  scroll = true,
  edges = ['left', 'right', 'bottom'],
}: ScreenProps) {
  const theme = useTheme();
  const padding = { padding: theme.space.md, gap: theme.space.md };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.background }]} edges={edges}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[padding, { paddingBottom: theme.space.xl }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, padding]}>{children}</View>
        )}
        {bottomAction ? (
          <View
            style={{
              paddingHorizontal: theme.space.md,
              paddingTop: theme.space.sm,
              paddingBottom: theme.space.sm,
              backgroundColor: theme.colors.background,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.border,
              gap: theme.space.xs,
            }}
          >
            {bottomAction}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
