import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Pinned under the content (e.g. a Done button), in the thumb zone. */
  footer?: ReactNode;
};

const OFFSCREEN = 600;

/**
 * A sheet that slides up from the bottom. Close it by swiping down, tapping the
 * dimmed background, the Close button (for screen readers), or Android's back.
 * With Reduce Motion it fades instead of sliding.
 */
export function BottomSheet({ visible, onClose, title, children, footer }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Stays mounted while the closing animation plays.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const offset = useSharedValue(OFFSCREEN);
  const fade = useSharedValue(0);

  useEffect(() => {
    const duration = theme.motion.slow;
    if (visible) {
      offset.set(reduceMotion ? 0 : withTiming(0, { duration }));
      fade.set(withTiming(1, { duration }));
    } else {
      fade.set(withTiming(0, { duration: theme.motion.fast }));
      offset.set(
        withTiming(reduceMotion ? 0 : OFFSCREEN, { duration: theme.motion.fast }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, reduceMotion, offset, fade, theme.motion]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      offset.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) runOnJS(onClose)();
      else offset.set(withTiming(0, { duration: theme.motion.fast }));
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    opacity: reduceMotion ? fade.value : 1,
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View
          style={[styles.fill, { backgroundColor: theme.colors.overlay }, backdropStyle]}
        >
          <Pressable
            style={styles.fill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.bottom}
          pointerEvents="box-none"
        >
          <Animated.View
            accessibilityViewIsModal
            style={[
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.radius.sheet,
                borderTopRightRadius: theme.radius.sheet,
                paddingHorizontal: theme.space.md,
                paddingBottom: Math.max(insets.bottom, theme.space.md),
                maxHeight: '90%',
              },
              theme.elevation(3),
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={drag}>
              <View style={[styles.header, { paddingVertical: theme.space.xs }]}>
                <View
                  style={[styles.handle, { backgroundColor: theme.colors.border }]}
                  accessible={false}
                />
                <View style={styles.titleRow}>
                  <Text variant="heading" accessibilityRole="header" style={styles.title}>
                    {title ?? ''}
                  </Text>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={onClose}
                    hitSlop={8}
                    style={[styles.close, { width: theme.size.tap, height: theme.size.tap }]}
                  >
                    <Icon name="close" color="textMuted" />
                  </PressableScale>
                </View>
              </View>
            </GestureDetector>
            <View style={{ gap: theme.space.sm, flexShrink: 1 }}>{children}</View>
            {footer ? <View style={{ paddingTop: theme.space.md }}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill,
  bottom: { flex: 1, justifyContent: 'flex-end' },
  header: { alignItems: 'center' },
  handle: { width: 40, height: 5, borderRadius: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 4 },
  title: { flex: 1 },
  close: { alignItems: 'center', justifyContent: 'center' },
});
