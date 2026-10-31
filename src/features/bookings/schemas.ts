import { z } from 'zod';

import { normalizeTime } from '@/features/pets/logic';
import type { Database } from '@/types/database';

// Booking dates and times are wall-clock values in the business's time zone
// (see confirm_booking), so they stay plain strings and are never converted to UTC.

export const WEEKDAYS = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
] as const;
export type Weekday = (typeof WEEKDAYS)[number]['value'];

export const DURATIONS = ['15', '30', '45', '60'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A Date → "YYYY-MM-DD" in the device's local calendar. */
export function toDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** "YYYY-MM-DD" plus a number of days. */
export function addDays(value: string, days: number): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const time = (message: string) =>
  z
    .string()
    .trim()
    .refine((v) => normalizeTime(v) !== null, message)
    .transform((v) => normalizeTime(v)!);

const optionalTime = z
  .string()
  .trim()
  .refine((v) => v === '' || normalizeTime(v) !== null, 'Use a 24-hour time like 13:00')
  .transform((v) => (v === '' ? '' : normalizeTime(v)!));

/** `today` is "YYYY-MM-DD"; the server checks it again in the business's time zone. */
export function bookingRequestSchema(today: string) {
  return z
    .object({
      petIds: z.array(z.string()).min(1, 'Choose at least one pet'),
      service: z.enum(['drop_in', 'walk', 'overnight']),
      repeat: z.enum(['once', 'daily', 'weekly']),
      days: z.array(z.enum(WEEKDAYS.map((d) => d.value) as [Weekday, ...Weekday[]])),
      startDate: z
        .string()
        .trim()
        .refine(isCalendarDate, 'Use a real date like 2026-11-20')
        .refine((v) => !isCalendarDate(v) || v >= today, 'Pick today or a later date')
        .refine(
          (v) => !isCalendarDate(v) || v <= addDays(today, 365),
          'Pick a date within the next year',
        ),
      endDate: z
        .string()
        .trim()
        .refine((v) => v === '' || isCalendarDate(v), 'Use a real date like 2026-11-20'),
      arrivalStart: time('Use a 24-hour time like 09:00'),
      arrivalEnd: optionalTime,
      durationMinutes: z.enum(DURATIONS),
      notes: z.string().trim().max(1000, 'Keep notes under 1000 characters'),
    })
    .superRefine((v, ctx) => {
      const overnight = v.service === 'overnight';
      if (!overnight && v.repeat === 'weekly' && v.days.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['days'], message: 'Choose at least one day' });
      }
      if (overnight && v.endDate === '') {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'When will you be back?' });
      }
      const usesEndDate = overnight || v.repeat !== 'once';
      if (usesEndDate && isCalendarDate(v.endDate) && isCalendarDate(v.startDate)) {
        if (overnight && v.endDate <= v.startDate) {
          ctx.addIssue({
            code: 'custom',
            path: ['endDate'],
            message: 'Pick a date after the first night',
          });
        } else if (v.endDate < v.startDate) {
          ctx.addIssue({
            code: 'custom',
            path: ['endDate'],
            message: 'End date can’t be before the start date',
          });
        }
      }
      if (overnight && v.arrivalEnd === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['arrivalEnd'],
          message: 'When should the sitter leave?',
        });
      }
      if (!overnight && v.arrivalEnd !== '' && v.arrivalEnd <= v.arrivalStart) {
        ctx.addIssue({
          code: 'custom',
          path: ['arrivalEnd'],
          message: 'Latest arrival must be after the earliest',
        });
      }
    });
}

export type BookingRequestValues = z.input<ReturnType<typeof bookingRequestSchema>>;

export function emptyBookingRequest(today: string): BookingRequestValues {
  return {
    petIds: [],
    service: 'drop_in',
    repeat: 'once',
    days: [],
    startDate: addDays(today, 1),
    endDate: '',
    arrivalStart: '09:00',
    arrivalEnd: '',
    durationMinutes: '30',
    notes: '',
  };
}

/** Sensible default times when switching between visits and overnight stays. */
export function defaultTimesFor(service: BookingRequestValues['service']) {
  return service === 'overnight'
    ? { arrivalStart: '19:00', arrivalEnd: '08:00' }
    : { arrivalStart: '09:00', arrivalEnd: '' };
}

export type RequestBookingArgs = Database['public']['Functions']['request_booking']['Args'];

/** Form values → request_booking arguments. Fields that don't apply are dropped. */
export function toRequestBookingArgs(
  values: BookingRequestValues,
  today: string,
): RequestBookingArgs {
  const v = bookingRequestSchema(today).parse(values);
  const notes = v.notes === '' ? undefined : v.notes;

  if (v.service === 'overnight') {
    return {
      p_service_type: 'overnight',
      p_pet_ids: v.petIds,
      p_start_date: v.startDate,
      p_end_date: v.endDate,
      p_window_start: v.arrivalStart,
      p_window_end: v.arrivalEnd || undefined,
      p_notes: notes,
    };
  }

  const days = WEEKDAYS.map((d) => d.value).filter((d) => v.days.includes(d));
  const rule =
    v.repeat === 'daily'
      ? 'FREQ=DAILY'
      : v.repeat === 'weekly'
        ? `FREQ=WEEKLY;BYDAY=${days.join(',')}`
        : undefined;

  return {
    p_service_type: v.service,
    p_pet_ids: v.petIds,
    p_start_date: v.startDate,
    p_end_date: v.repeat === 'once' || v.endDate === '' ? undefined : v.endDate,
    p_window_start: v.arrivalStart,
    p_window_end: v.arrivalEnd || undefined,
    p_duration_minutes: Number(v.durationMinutes),
    p_recurrence_rule: rule,
    p_notes: notes,
  };
}
