import { useQuery } from '@tanstack/react-query';

import { useProfile } from '@/features/auth/use-profile';
import { supabase } from '@/lib/supabase';
import { deviceTimeZone } from '@/lib/time-zone';

export type OrgSettings = {
  id: string;
  name: string;
  timeZone: string;
  travelBufferMinutes: number;
  cancellationCutoffHours: number;
  /** Visit media older than this is deleted nightly; null keeps it. */
  mediaRetentionMonths: number | null;
  /** White-label branding, set in the admin web app (#RRGGBB or null). */
  primaryColor: string | null;
  accentColor: string | null;
  /** pet-media path of the logo (`{org}/branding/...`). */
  logoPath: string | null;
};

export const orgKeys = { settings: ['org-settings'] as const };

async function fetchOrgSettings(): Promise<OrgSettings | null> {
  // RLS: members read only their own organization.
  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, timezone, travel_buffer_minutes, cancellation_cutoff_hours, media_retention_months, primary_color, accent_color, logo_path',
    )
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id,
        name: data.name,
        timeZone: data.timezone,
        travelBufferMinutes: data.travel_buffer_minutes,
        cancellationCutoffHours: data.cancellation_cutoff_hours,
        mediaRetentionMonths: data.media_retention_months,
        primaryColor: data.primary_color,
        accentColor: data.accent_color,
        logoPath: data.logo_path,
      }
    : null;
}

/** The business's time zone and scheduling settings. */
export function useOrgSettings() {
  const profile = useProfile();
  return useQuery({
    queryKey: orgKeys.settings,
    queryFn: fetchOrgSettings,
    enabled: !!profile.data,
    staleTime: 10 * 60_000,
  });
}

/** The business's time zone, or the device's until it has loaded. */
export function useOrgTimeZone(): string {
  return useOrgSettings().data?.timeZone ?? deviceTimeZone();
}
