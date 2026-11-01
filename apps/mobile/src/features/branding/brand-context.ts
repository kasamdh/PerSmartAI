import { brandPalette, type BrandPalette } from '@petsitter/shared/branding';
import { createContext, useContext } from 'react';

// Kept free of Supabase imports so shared components (BigButton) can use it.

export type Brand = {
  colors: BrandPalette;
  /** The business name, once signed in. */
  name: string | null;
  /** Signed URL of the logo (1 hour), or null. */
  logoUrl: string | null;
  /** The business's own primary color, if it set one (the theme adapts it per mode). */
  customPrimary: string | null;
};

export const DEFAULT_BRAND: Brand = {
  colors: brandPalette({}),
  name: null,
  logoUrl: null,
  customPrimary: null,
};

/** Provided by BrandProvider; tests can provide a value directly. */
export const BrandContext = createContext<Brand>(DEFAULT_BRAND);

/** The business's colors and logo (defaults before sign-in or when unset). */
export function useBrand(): Brand {
  return useContext(BrandContext);
}

/** Stack header options in the business's colors. */
export function useBrandedHeader() {
  const { colors } = useBrand();
  return {
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: colors.onPrimary,
    headerTitleStyle: { color: colors.onPrimary },
    headerBackTitle: 'Back',
  };
}
