import { logoPath } from '@petsitter/shared/branding';
import {
  LOGO_TYPES,
  toOrganizationUpdate,
  type OrgSettingsValues,
} from '@petsitter/shared/org-settings-schema';

import { PET_MEDIA_BUCKET } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';

export async function saveSettings(orgId: string, values: OrgSettingsValues) {
  const { data, error } = await supabase
    .from('organizations')
    .update(toOrganizationUpdate(values))
    .eq('id', orgId)
    .select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error('Only admins can change these settings.');
}

/**
 * Uploads a new logo to `{org}/branding/` (a new name each time, so phones don't
 * keep a cached copy), points the business at it, then removes the old file.
 */
export async function replaceLogo(org: { id: string; logoPath: string | null }, file: File) {
  const extension = LOGO_TYPES[file.type as keyof typeof LOGO_TYPES];
  const path = logoPath(org.id, extension, Date.now());
  const upload = await supabase.storage
    .from(PET_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw upload.error;
  await setLogoPath(org, path);
}

export async function removeLogo(org: { id: string; logoPath: string | null }) {
  await setLogoPath(org, null);
}

async function setLogoPath(org: { id: string; logoPath: string | null }, path: string | null) {
  const { error } = await supabase
    .from('organizations')
    .update({ logo_path: path })
    .eq('id', org.id);
  if (error) {
    if (path) await supabase.storage.from(PET_MEDIA_BUCKET).remove([path]);
    throw error;
  }
  if (org.logoPath) {
    // Best effort: an orphaned old logo is harmless.
    await supabase.storage.from(PET_MEDIA_BUCKET).remove([org.logoPath]);
  }
}
