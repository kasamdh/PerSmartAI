// Which backend and build this is: set per EAS build profile (eas.json `env`),
// and "development" for local runs.
export type AppEnv = 'development' | 'preview' | 'production';

const value = process.env.EXPO_PUBLIC_APP_ENV;

export const APP_ENV: AppEnv =
  value === 'production' || value === 'preview' ? value : 'development';
