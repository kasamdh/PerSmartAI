import { brandPalette, isHexColor } from '@petsitter/shared/branding';
import { useQuery } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';

import { useOrgSettings } from '@/features/scheduling/hooks';
import { signedPetMediaUrl } from '@/lib/images';

import { BrandContext, type Brand } from './brand-context';

export { useBrand, useBrandedHeader, type Brand } from './brand-context';

/** Reads the signed-in user's business colors and logo for the whole app. */
export function BrandProvider({ children }: { children: ReactNode }) {
  const org = useOrgSettings().data;
  const logoPath = org?.logoPath ?? null;
  const logo = useQuery({
    queryKey: ['brand-logo', logoPath],
    queryFn: () => signedPetMediaUrl(logoPath!),
    enabled: !!logoPath,
    // Signed for an hour; refresh well before it expires.
    staleTime: 45 * 60_000,
  });

  const primaryColor = org?.primaryColor;
  const accentColor = org?.accentColor;
  const value = useMemo<Brand>(
    () => ({
      colors: brandPalette({ primaryColor, accentColor }),
      name: org?.name ?? null,
      logoUrl: logoPath ? (logo.data ?? null) : null,
      customPrimary: isHexColor(primaryColor) ? primaryColor : null,
    }),
    [primaryColor, accentColor, org?.name, logoPath, logo.data],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}
