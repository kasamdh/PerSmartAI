import { z } from 'zod';

import { isHexColor } from './branding.ts';

// Business settings edited in the admin web app. Limits match the database checks
// (scheduling_settings, media_sharing, branding_and_incidents migrations).

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const color = z
  .string()
  .trim()
  .refine((v) => v === '' || isHexColor(v), 'Use a color like #0E7C66')
  .transform((v) => (v === '' ? null : v.toUpperCase()));

export const orgSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Enter the business name').max(120),
  timeZone: z.string().refine(isTimeZone, 'Pick a time zone'),
  travelBufferMinutes: z.coerce.number().int().min(0).max(240, 'At most 240 minutes'),
  cancellationCutoffHours: z.coerce.number().int().min(0).max(336, 'At most 336 hours (2 weeks)'),
  /** '' keeps media forever. */
  mediaRetentionMonths: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(120)])
    .transform((v) => (v === '' ? null : v)),
  primaryColor: color,
  accentColor: color,
});

export type OrgSettingsInput = z.input<typeof orgSettingsSchema>;
export type OrgSettingsValues = z.output<typeof orgSettingsSchema>;

/** Form values → an organizations update. */
export function toOrganizationUpdate(values: OrgSettingsValues) {
  return {
    name: values.name,
    timezone: values.timeZone,
    travel_buffer_minutes: values.travelBufferMinutes,
    cancellation_cutoff_hours: values.cancellationCutoffHours,
    media_retention_months: values.mediaRetentionMonths,
    primary_color: values.primaryColor,
    accent_color: values.accentColor,
  };
}

/** Why a logo file can't be used, or null. */
export function logoProblem(file: { type: string; size: number }): string | null {
  if (!(file.type in LOGO_TYPES)) return 'Use a PNG, JPEG or WebP image';
  if (file.size > LOGO_MAX_BYTES) return 'The logo must be 1 MB or smaller';
  return null;
}
