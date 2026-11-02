import { brandPalette } from '@petsitter/shared/branding';
import { redirect } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';

import { signOut } from '@/app/actions';
import { Button } from '@/components/ui';
import { OrgProvider, type Org } from '@/features/org/org-context';
import { AdminNav } from '@/features/org/admin-nav';
import { IdleSignOut } from '@/features/org/idle-sign-out';
import { createClient } from '@/lib/supabase/server';
import { PET_MEDIA_BUCKET } from '@/lib/storage';

// Admins only. This check is for the UI; RLS limits every query to the admin's
// own business and admin-only rows, whatever the browser sends.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold">This site is for business admins</h1>
          <p className="mt-2 text-sm text-gray-600">
            Owners and sitters use the Petsitters app on their phone.
          </p>
          <form action={signOut} className="mt-6">
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </main>
    );
  }

  // Admin access needs a two-step session (the database enforces it too).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/two-step');

  const { data: row, error } = await supabase
    .from('organizations')
    .select(
      'id, name, timezone, travel_buffer_minutes, cancellation_cutoff_hours, media_retention_months, primary_color, accent_color, logo_path',
    )
    .single();
  if (error) throw error;

  let logoUrl: string | null = null;
  if (row.logo_path) {
    const { data } = await supabase.storage
      .from(PET_MEDIA_BUCKET)
      .createSignedUrl(row.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  const org: Org = {
    id: row.id,
    name: row.name,
    timeZone: row.timezone,
    travelBufferMinutes: row.travel_buffer_minutes,
    cancellationCutoffHours: row.cancellation_cutoff_hours,
    mediaRetentionMonths: row.media_retention_months,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    logoPath: row.logo_path,
    logoUrl,
  };
  const colors = brandPalette(org);
  const brandVars = {
    '--brand': colors.primary,
    '--on-brand': colors.onPrimary,
    '--brand-ink': colors.primaryOnWhite,
  } as CSSProperties;

  return (
    <OrgProvider org={org} admin={{ id: profile.id, fullName: profile.full_name }}>
      <IdleSignOut />
      <div style={brandVars} className="min-h-screen lg:flex">
        <AdminNav orgName={org.name} logoUrl={logoUrl} adminName={profile.full_name} />
        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </OrgProvider>
  );
}
