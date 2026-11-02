/**
 * Returns the value of a required public env var, or throws a clear error.
 *
 * Callers must pass `process.env.EXPO_PUBLIC_*` with a static name: Expo only
 * inlines EXPO_PUBLIC_ variables when the property is accessed literally.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value.trim();
}
