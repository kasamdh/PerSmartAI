'use client';

import {
  DEFAULT_PRIMARY,
  brandPalette,
  contrastRatio,
  isHexColor,
} from '@petsitter/shared/branding';
import {
  logoProblem,
  orgSettingsSchema,
  type OrgSettingsInput,
} from '@petsitter/shared/org-settings-schema';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Button, Card, Field, PageHeader, inputClass } from '@/components/ui';
import { useOrg } from '@/features/org/org-context';
import { errorMessage } from '@/lib/format';

import { removeLogo, replaceLogo, saveSettings } from './api';

const RETENTION = [
  { value: '', label: 'Keep everything' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
  { value: '24', label: '2 years' },
];

type FieldErrors = Partial<Record<keyof OrgSettingsInput, string>>;

export function SettingsForm() {
  const { org } = useOrg();
  const router = useRouter();
  const [form, setForm] = useState<Record<keyof OrgSettingsInput, string>>({
    name: org.name,
    timeZone: org.timeZone,
    travelBufferMinutes: String(org.travelBufferMinutes),
    cancellationCutoffHours: String(org.cancellationCutoffHours),
    mediaRetentionMonths: org.mediaRetentionMonths === null ? '' : String(org.mediaRetentionMonths),
    primaryColor: org.primaryColor ?? '',
    accentColor: org.accentColor ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const set = (key: keyof OrgSettingsInput) => (value: string) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const timeZones = useMemo(() => {
    const zones = Intl.supportedValuesOf('timeZone');
    return zones.includes(org.timeZone) ? zones : [org.timeZone, ...zones];
  }, [org.timeZone]);

  const save = useMutation({
    mutationFn: (values: ReturnType<typeof orgSettingsSchema.parse>) =>
      saveSettings(org.id, values),
    onSuccess: () => {
      setSaved(true);
      // Reloads the layout so the new name, colors and time zone apply everywhere.
      router.refresh();
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = orgSettingsSchema.safeParse(form);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof OrgSettingsInput;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  };

  return (
    <>
      <PageHeader title="Settings" />
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <Card title="Business">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Business name" error={errors.name}>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => set('name')(e.target.value)}
              />
            </Field>
            <Field
              label="Time zone"
              hint="Visits, availability and feeding times are in this zone."
              error={errors.timeZone}
            >
              <select
                className={inputClass}
                value={form.timeZone}
                onChange={(e) => set('timeZone')(e.target.value)}
              >
                {timeZones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <Card title="Scheduling">
          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Travel buffer (minutes)"
              hint="Gap a sitter needs between visits at different homes."
              error={errors.travelBufferMinutes}
            >
              <input
                type="number"
                min={0}
                max={240}
                className={inputClass}
                value={form.travelBufferMinutes}
                onChange={(e) => set('travelBufferMinutes')(e.target.value)}
              />
            </Field>
            <Field
              label="Cancellation cutoff (hours)"
              hint="Cancelling later than this before a visit counts as late."
              error={errors.cancellationCutoffHours}
            >
              <input
                type="number"
                min={0}
                max={336}
                className={inputClass}
                value={form.cancellationCutoffHours}
                onChange={(e) => set('cancellationCutoffHours')(e.target.value)}
              />
            </Field>
            <Field
              label="Keep visit photos and videos"
              hint="Older media is deleted nightly."
              error={errors.mediaRetentionMonths}
            >
              <select
                className={inputClass}
                value={form.mediaRetentionMonths}
                onChange={(e) => set('mediaRetentionMonths')(e.target.value)}
              >
                {(RETENTION.some((r) => r.value === form.mediaRetentionMonths)
                  ? RETENTION
                  : [
                      ...RETENTION,
                      {
                        value: form.mediaRetentionMonths,
                        label: `${form.mediaRetentionMonths} months`,
                      },
                    ]
                ).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <Card title="Branding">
          <p className="mb-4 text-sm text-gray-600">
            Your logo and colors appear in the Petsitters app for your clients and sitters, and on
            this site.
          </p>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <ColorField
                label="Primary color"
                hint="Buttons and headers"
                value={form.primaryColor}
                error={errors.primaryColor}
                onChange={set('primaryColor')}
              />
              <ColorField
                label="Accent color"
                hint="Business name and active tabs"
                value={form.accentColor}
                error={errors.accentColor}
                onChange={set('accentColor')}
              />
            </div>
            <BrandPreview
              name={form.name}
              primary={form.primaryColor}
              accent={form.accentColor}
              logoUrl={org.logoUrl}
            />
          </div>
          <LogoUpload />
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
          {saved ? (
            <span className="text-sm font-medium text-green-800" role="status">
              Saved.
            </span>
          ) : null}
          {save.error ? (
            <span className="text-sm text-red-700" role="alert">
              {errorMessage(save.error)}
            </span>
          ) : null}
        </div>
      </form>
    </>
  );
}

function ColorField({
  label,
  hint,
  value,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={value ? hint : `${hint}. Empty uses the default.`} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          className="h-10 w-14 cursor-pointer rounded border border-gray-300"
          value={isHexColor(value) ? value : DEFAULT_PRIMARY}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          className={`${inputClass} max-w-36 font-mono`}
          placeholder="#0E7C66"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value ? (
          <Button variant="ghost" onClick={() => onChange('')}>
            Use default
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

/** How the app will look; text color is picked automatically to stay readable. */
function BrandPreview({
  name,
  primary,
  accent,
  logoUrl,
}: {
  name: string;
  primary: string;
  accent: string;
  logoUrl: string | null;
}) {
  const colors = brandPalette({ primaryColor: primary, accentColor: accent });
  const adjusted =
    colors.primaryOnWhite !== colors.primary || colors.accentOnWhite !== colors.accent;
  return (
    <div>
      <div className="text-sm font-medium text-gray-800">App preview</div>
      <div className="mt-1 w-full max-w-xs overflow-hidden rounded-2xl border border-gray-200 bg-[#F2F4F7]">
        <div
          className="px-4 py-3 font-semibold"
          style={{ background: colors.primary, color: colors.onPrimary }}
        >
          My pets
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
            ) : null}
            <span className="font-bold" style={{ color: colors.accentOnWhite }}>
              {name || 'Your business'}
            </span>
          </div>
          <div
            className="rounded-xl py-3 text-center font-semibold"
            style={{ background: colors.primary, color: colors.onPrimary }}
          >
            Book a visit
          </div>
          <div
            className="rounded-xl border-2 bg-white py-3 text-center font-semibold"
            style={{ borderColor: colors.primaryOnWhite, color: colors.primaryOnWhite }}
          >
            My bookings
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Button text contrast {contrastRatio(colors.primary, colors.onPrimary).toFixed(1)}:1.
        {adjusted ? ' Light colors are darkened for text on white so it stays readable.' : ''}
      </p>
    </div>
  );
}

function LogoUpload() {
  const { org } = useOrg();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => replaceLogo(org, file),
    onSuccess: () => router.refresh(),
  });
  const remove = useMutation({
    mutationFn: () => removeLogo(org),
    onSuccess: () => router.refresh(),
  });
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      <div className="text-sm font-medium text-gray-800">Logo</div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logoUrl}
            alt="Current logo"
            className="h-16 w-16 rounded-lg border border-gray-200 object-contain"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-500">
            None
          </div>
        )}
        <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold hover:bg-gray-50">
          {upload.isPending ? 'Uploading…' : org.logoUrl ? 'Replace logo' : 'Upload logo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const why = logoProblem(file);
              setProblem(why);
              if (!why) upload.mutate(file);
            }}
          />
        </label>
        {org.logoUrl ? (
          <Button variant="ghost" disabled={busy} onClick={() => remove.mutate()}>
            Remove
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-gray-500">Square PNG, JPEG or WebP, up to 1 MB.</p>
      {problem || upload.error || remove.error ? (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {problem ?? errorMessage(upload.error ?? remove.error)}
        </p>
      ) : null}
    </div>
  );
}
