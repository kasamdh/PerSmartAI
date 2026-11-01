import { scrubBreadcrumb, scrubEvent } from '@petsitter/shared/telemetry-scrub';
import * as Sentry from '@sentry/react-native';

import { APP_ENV } from './app-env';

// Crash and error reporting (Sentry). Off unless EXPO_PUBLIC_SENTRY_DSN is set
// (the DSN is public by design; uploading source maps needs SENTRY_AUTH_TOKEN,
// which only lives in EAS secrets). Personal data never goes out: no default PII,
// no screenshots or view hierarchy (they'd show addresses and messages), and every
// event and breadcrumb passes through the shared scrubber.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = !!DSN && !__DEV__;

export function initMonitoring() {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn: DSN,
    environment: APP_ENV,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    // Touch breadcrumbs name the pressed element, which can be a person's name.
    enableUserInteractionTracing: false,
    maxBreadcrumbs: 50,
    tracesSampleRate: APP_ENV === 'production' ? 0.1 : 1,
    integrations: [Sentry.expoRouterIntegration()],
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
}

/** Tags reports with the signed-in user's id and role only (no name or email). */
export function setMonitoringUser(user: { id: string; role: string } | null) {
  if (!monitoringEnabled) return;
  Sentry.setUser(user ? { id: user.id } : null);
  Sentry.setTag('role', user?.role ?? 'signed_out');
}

/** Reports an error that was handled (e.g. a failed upload that will retry). */
export function reportError(error: unknown, context?: Record<string, string | number | boolean>) {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export const wrapRoot = Sentry.wrap;
