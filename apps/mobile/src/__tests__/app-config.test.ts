import type { ExpoConfig } from 'expo/config';

import appJson from '../../app.json';

// Guards what the stores see: ids per variant, plain-language permission texts,
// and no background location (the app only uses location at check-in/out).

function resolve(variant: string): ExpoConfig {
  const previous = process.env.APP_VARIANT;
  process.env.APP_VARIANT = variant;
  try {
    let config!: ExpoConfig;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const build = require('../../app.config').default as (ctx: {
        config: ExpoConfig;
      }) => ExpoConfig;
      config = build({ config: structuredClone(appJson.expo) as unknown as ExpoConfig });
    });
    return config;
  } finally {
    process.env.APP_VARIANT = previous;
  }
}

const pluginOptions = (config: ExpoConfig, name: string) => {
  const entry = config.plugins?.find((p) => (Array.isArray(p) ? p[0] : p) === name);
  return (Array.isArray(entry) ? entry[1] : undefined) as Record<string, unknown> | undefined;
};

describe('store app config', () => {
  it('uses the store name and ids for production, separate ones for test builds', () => {
    const production = resolve('production');
    expect(production.name).toBe('Pet Sitter');
    expect(production.ios?.bundleIdentifier).toBe('com.kasamdh.petsitter');
    expect(production.android?.package).toBe('com.kasamdh.petsitter');
    expect(production.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(resolve('preview').ios?.bundleIdentifier).toBe('com.kasamdh.petsitter.preview');
    expect(resolve('development').android?.package).toBe('com.kasamdh.petsitter.dev');
  });

  it('never asks for background location', () => {
    const config = resolve('production');
    const location = pluginOptions(config, 'expo-location');
    expect(location).toMatchObject({
      locationAlwaysAndWhenInUsePermission: false,
      locationAlwaysPermission: false,
      isIosBackgroundLocationEnabled: false,
      isAndroidBackgroundLocationEnabled: false,
      isAndroidForegroundServiceEnabled: false,
    });
    expect(config.android?.permissions).not.toContain(
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    );
    expect(config.android?.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
      ]),
    );
    expect(config.ios?.infoPlist?.UIBackgroundModes ?? []).not.toContain('location');
  });

  it('explains each permission in plain words', () => {
    const config = resolve('production');
    const texts = [
      pluginOptions(config, 'expo-camera')?.cameraPermission,
      pluginOptions(config, 'expo-image-picker')?.cameraPermission,
      pluginOptions(config, 'expo-location')?.locationWhenInUsePermission,
      pluginOptions(config, 'expo-media-library')?.savePhotosPermission,
    ];
    for (const text of texts) {
      expect(typeof text).toBe('string');
      expect(text).toMatch(/^Pet Sitter /);
      expect(text).not.toMatch(/\$\(PRODUCT_NAME\)/);
    }
    expect(pluginOptions(config, 'expo-location')?.locationWhenInUsePermission).toMatch(
      /check in or out/,
    );
  });

  it('declares only standard encryption (no export paperwork)', () => {
    expect(resolve('production').ios?.config?.usesNonExemptEncryption).toBe(false);
  });
});
