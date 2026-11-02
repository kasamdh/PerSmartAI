// Expo's default Metro config plus Sentry's serializer, which adds debug IDs so
// uploaded source maps match the bundle (EAS builds and `eas update`).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
