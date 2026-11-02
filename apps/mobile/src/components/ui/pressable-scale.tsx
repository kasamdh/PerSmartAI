import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while pressed (default from motion tokens). */
  pressedScale?: number;
};

/**
 * A Pressable with a soft spring "press" (scales down slightly). With Reduce
 * Motion on, it doesn't move.
 */
export function PressableScale({
  pressedScale,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const target = pressedScale ?? theme.motion.pressedScale;

  return (
    <AnimatedPressable
      onPressIn={(event) => {
        if (!reduceMotion) scale.set(withSpring(target, theme.motion.spring));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduceMotion) scale.set(withSpring(1, theme.motion.spring));
        onPressOut?.(event);
      }}
      style={[style, animated]}
      {...rest}
    />
  );
}
