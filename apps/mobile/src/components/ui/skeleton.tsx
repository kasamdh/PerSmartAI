import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

/** A soft placeholder block that gently pulses (still with Reduce Motion). */
export function Skeleton({
  width = '100%',
  height = 16,
  radius,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.45, { duration: 800 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
        },
        style,
      ]}
    />
  );
}

/**
 * Loading state for a list: a few card-shaped placeholders. Screen readers hear
 * "Loading" once instead of empty shapes.
 */
export function SkeletonList({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ gap: theme.space.sm }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.card,
            padding: theme.space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
          }}
        >
          <Skeleton
            width={theme.size.avatar.sm}
            height={theme.size.avatar.sm}
            radius={theme.radius.pill}
          />
          <View style={{ flex: 1, gap: theme.space.xs }}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}
