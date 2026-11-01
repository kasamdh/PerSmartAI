import * as Sentry from '@sentry/nextjs';

import { sentryOptions } from '@/lib/sentry-options';

// Browser error reporting. Session replay and user-feedback widgets stay off:
// they'd record client details shown on screen.
Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
