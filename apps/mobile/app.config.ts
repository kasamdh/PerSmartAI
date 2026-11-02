import { withInfoPlist, type ConfigPlugin } from 'expo/config-plugins';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// One codebase, three apps (set APP_VARIANT per EAS build profile in eas.json):
//   development  dev client, staging Supabase      com.kasamdh.petsitter.dev
//   preview      internal testers, staging Supabase com.kasamdh.petsitter.preview
//   production   the stores, production Supabase    com.kasamdh.petsitter
// They install side by side. Supabase URL/keys, Sentry DSN and PostHog key come
// from EAS environment variables (`eas env:list`), never from this file.

type Variant = 'development' | 'preview' | 'production';

const variant: Variant =
  process.env.APP_VARIANT === 'production' || process.env.APP_VARIANT === 'preview'
    ? process.env.APP_VARIANT
    : 'development';

const BASE_ID = 'com.kasamdh.petsitter';
const id =
  variant === 'production' ? BASE_ID : `${BASE_ID}.${variant === 'preview' ? 'preview' : 'dev'}`;
const name =
  variant === 'production'
    ? 'Petsitters'
    : `Petsitters ${variant === 'preview' ? 'Preview' : 'Dev'}`;

// The dev client's local-network prompt text ships in every build; store builds
// never use it, and App Review asks about local-network access, so drop it there.
const withoutDevClientPrompts: ConfigPlugin = (cfg) =>
  withInfoPlist(cfg, (mod) => {
    delete mod.modResults.NSLocalNetworkUsageDescription;
    delete mod.modResults.NSBonjourServices;
    return mod;
  });

// Versions: `version` (app.json) is what people see; build numbers (iOS buildNumber,
// Android versionCode) are kept by EAS (`appVersionSource: remote`,
// `autoIncrement` on the production profile), so they're never set here.
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = config.extra?.eas?.projectId as string;
  const resolved: ExpoConfig = {
    ...config,
    name,
    slug: config.slug ?? 'PetSitter',
    // Deep links stay distinct so a link opens the right app.
    scheme: variant === 'production' ? 'petsitter' : `petsitter-${variant}`,
    ios: { ...config.ios, bundleIdentifier: id },
    android: {
      ...config.android,
      package: id,
      // Each package needs its own Firebase app for push; EAS file variable per environment.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
    // EAS Update: builds on a channel get updates published to it (eas.json `channel`).
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      url: `https://u.expo.dev/${projectId}`,
      // A broken update must never brick the app: fall back to the embedded bundle.
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    plugins: [
      ...(config.plugins ?? []).map((plugin) =>
        plugin === '@sentry/react-native'
          ? ([
              '@sentry/react-native',
              {
                organization: process.env.SENTRY_ORG,
                project: process.env.SENTRY_MOBILE_PROJECT,
                url: 'https://sentry.io/',
              },
            ] as [string, unknown])
          : plugin,
      ),
    ],
    extra: { ...config.extra, appVariant: variant },
  };
  return variant === 'production' ? withoutDevClientPrompts(resolved) : resolved;
};
