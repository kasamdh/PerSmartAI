// A small stand-in for react-native-reanimated in Jest (its own mock needs the
// native runtime). Animations jump straight to their end value, so tests see the
// final state. Covers what src/components/ui uses; add APIs here as needed.
const React = require('react');
const { View, Text, ScrollView, Image } = require('react-native');

function useSharedValue(initial) {
  const ref = React.useRef(null);
  if (ref.current === null) {
    const box = { value: initial };
    box.get = () => box.value;
    box.set = (next) => {
      box.value = typeof next === 'function' ? next(box.value) : next;
    };
    ref.current = box;
  }
  return ref.current;
}

const finish = (to, callback) => {
  if (typeof callback === 'function') callback(true);
  return to;
};

const layoutAnimation = () => {
  const chain = { duration: () => chain, delay: () => chain, springify: () => chain };
  return chain;
};

const createAnimatedComponent = (Component) =>
  React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref }));

const Animated = {
  View,
  Text,
  ScrollView,
  Image,
  createAnimatedComponent,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue,
  useAnimatedStyle: (factory) => factory(),
  useDerivedValue: (factory) => ({ value: factory(), get: () => factory() }),
  useReducedMotion: () => false,
  withTiming: (to, _config, callback) => finish(to, callback),
  withSpring: (to, _config, callback) => finish(to, callback),
  withRepeat: (animation) => animation,
  withSequence: (...steps) => steps[steps.length - 1],
  cancelAnimation: () => {},
  // Used inside react-native-gesture-handler's GestureDetector.
  useEvent: () => () => {},
  useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  useComposedEventHandler: () => () => {},
  useAnimatedReaction: () => {},
  makeMutable: (value) => ({ value, get: () => value, set: () => {} }),
  isSharedValue: () => false,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  FadeIn: layoutAnimation(),
  FadeOut: layoutAnimation(),
  SlideInDown: layoutAnimation(),
  SlideOutDown: layoutAnimation(),
};
