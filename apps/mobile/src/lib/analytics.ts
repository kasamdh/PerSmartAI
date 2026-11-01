import {
  eventProperties,
  type AnalyticsEvent,
  type AnalyticsEventName,
} from '@petsitter/shared/analytics-events';
import PostHog from 'posthog-react-native';

import { APP_ENV } from './app-env';

// Product analytics (PostHog), key events only (see packages/shared
// analytics-events.ts). Off unless EXPO_PUBLIC_POSTHOG_KEY is set. Nobody is
// identified: no person profiles, no autocapture, no screen or lifecycle events,
// no session replay, no GeoIP, and properties pass an allowlist.

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;

const client =
  KEY && !__DEV__
    ? new PostHog(KEY, {
        host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        personProfiles: 'never',
        disableGeoip: true,
        captureAppLifecycleEvents: false,
        enableSessionReplay: false,
        sendFeatureFlagEvent: false,
        preloadFeatureFlags: false,
      })
    : null;

client?.register({ app_env: APP_ENV });

export function track<N extends AnalyticsEventName>(
  name: N,
  props: Extract<AnalyticsEvent, { name: N }>['props'],
) {
  client?.capture(name, eventProperties(name, props));
}

/** The role is the only thing known about who sent an event. */
export function setAnalyticsRole(role: string | null) {
  if (!client) return;
  if (role) client.register({ role });
  else client.reset();
}
