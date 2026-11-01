// Native modules Jest can't load. AsyncStorage ships an in-memory mock for this.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The CAPTCHA web view (native); tests render nothing in its place.
jest.mock('react-native-webview', () => ({ WebView: () => null }));

// Reanimated needs its native runtime; tests use a small stand-in (jest/reanimated-mock.js).
jest.mock('react-native-reanimated', () => require('./jest/reanimated-mock'));

// Gesture handler's own Jest setup, and the swipeable row as a plain wrapper
// (swiping needs a device; ListItem also offers its actions to screen readers).
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ children }, _ref) => children),
  };
});
