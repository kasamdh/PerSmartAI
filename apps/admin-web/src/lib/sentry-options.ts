import { scrubBreadcrumb, scrubEvent } from '@petsitter/shared/telemetry-scrub';

// Shared Sentry settings for the browser, Node and edge runtimes. Off unless
// NEXT_PUBLIC_SENTRY_DSN is set. The admin site shows clients' addresses and
// messages, so no default PII, no session replay, and every event and breadcrumb
// goes through the shared scrubber.

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NEXT_PUBLIC_APP_ENV ?? 'development';

export const sentryOptions = {
  dsn,
  enabled: !!dsn,
  environment,
  sendDefaultPii: false,
  tracesSampleRate: environment === 'production' ? 0.1 : 1,
  maxBreadcrumbs: 50,
  beforeSend: <E extends object>(event: E) => scrubEvent(event),
  beforeSendTransaction: <E extends object>(event: E) => scrubEvent(event),
  beforeBreadcrumb: <B extends object>(breadcrumb: B) => scrubBreadcrumb(breadcrumb),
};
