// Native modules Jest can't load. AsyncStorage ships an in-memory mock for this.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The CAPTCHA web view (native); tests render nothing in its place.
jest.mock('react-native-webview', () => ({ WebView: () => null }));
