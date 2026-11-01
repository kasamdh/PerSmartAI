import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useBrand } from '@/features/branding/brand-context';

import type { ColorScheme } from './colors';
import { buildTheme, type Theme } from './theme';

/**
 * Whether the app follows the phone's light/dark setting. Off until every screen
 * reads its colors from the theme (npm run design:check reports what's left);
 * then turn this on and set `userInterfaceStyle: "automatic"` in app.json.
 */
export const FOLLOW_PHONE_APPEARANCE = false;

const ThemeContext = createContext<Theme>(buildTheme('light'));

/**
 * Provides the theme: the phone's light/dark setting (once enabled) and the
 * business's brand color. `scheme` forces a mode (Design Preview, tests).
 */
export function ThemeProvider({ scheme, children }: { scheme?: ColorScheme; children: ReactNode }) {
  const phone = useColorScheme();
  const { customPrimary } = useBrand();
  const resolved: ColorScheme =
    scheme ?? (FOLLOW_PHONE_APPEARANCE && phone === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(resolved, customPrimary), [resolved, customPrimary]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Styles built from the theme, rebuilt only when the theme changes:
 *   const styles = useThemedStyles((t) => ({ box: { padding: t.space.md } }));
 */
export function useThemedStyles<T extends NamedStyles>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
}
