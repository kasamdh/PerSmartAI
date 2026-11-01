import { z } from 'zod';

import { normalizeTime } from './pets.ts';
import { buildRecurrenceRule, MAX_COUNT } from './scheduling/index.ts';
import type { Database } from './database.ts';

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
export const EVERY_WEEKS = ['1', '2', '3', '4'] as const;
export const MAX_STAY_DAYS = 90;
export const MAX_CARE_TIMES = 8;

const careTimeSchema = z.object({
  time: z.string().trim(),
  label: z.string(),
  durationMinutes: z.enum(DURATIONS),
});
export type CareTimeValues = z.input<typeof careTimeSchema>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
      service: z.enum(['drop_in', 'walk', 'overnight', 'multi_day']),
      repeat: z.enum(['once', 'daily', 'weekdays', 'weekly']),
      days: z.array(z.enum(WEEKDAYS.map((d) => d.value) as [Weekday, ...Weekday[]])),
      everyWeeks: z.enum(EVERY_WEEKS),
      count: z.string().trim(),
      careTimes: z.array(careTimeSchema),
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
      const stay = v.service === 'multi_day';
      const repeats = !overnight && !stay && v.repeat !== 'once';
      if (repeats && v.repeat === 'weekly' && v.days.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['days'], message: 'Choose at least one day' });
      }
      if (overnight && v.endDate === '') {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'When will you be back?' });
      }
      if (stay && v.endDate === '') {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'When does the stay end?' });
      }
      if (
        stay &&
        isCalendarDate(v.endDate) &&
        isCalendarDate(v.startDate) &&
        v.endDate > addDays(v.startDate, MAX_STAY_DAYS)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['endDate'],
          message: `Stays can be at most ${MAX_STAY_DAYS} days`,
        });
      }
      const usesEndDate = overnight || stay || repeats;
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
      if (repeats && v.count !== '') {
        const n = Number(v.count);
        if (!Number.isInteger(n) || n < 1 || n > MAX_COUNT) {
          ctx.addIssue({
            code: 'custom',
            path: ['count'],
            message: `Use a number between 1 and ${MAX_COUNT}`,
          });
        } else if (v.endDate !== '') {
          ctx.addIssue({
            code: 'custom',
            path: ['count'],
            message: 'Choose an end date or a number of visits, not both',
          });
        }
      }
      if (stay) {
        const times = v.careTimes.map((c) => normalizeTime(c.time));
        const message =
          v.careTimes.length === 0
            ? 'Add at least one care time'
            : v.careTimes.length > MAX_CARE_TIMES
              ? `Up to ${MAX_CARE_TIMES} care times a day`
              : times.some((t) => t === null)
                ? 'Use a 24-hour time like 08:00'
                : v.careTimes.some((c) => c.label.trim() === '')
                  ? 'Give each care time a name'
                  : new Set(times).size !== times.length
                    ? 'Two care times can’t be at the same time'
                    : null;
        if (message) ctx.addIssue({ code: 'custom', path: ['careTimes'], message });
      }
      if (overnight && v.arrivalEnd === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['arrivalEnd'],
          message: 'When should the sitter leave?',
        });
      }
      if (!overnight && !stay && v.arrivalEnd !== '' && v.arrivalEnd <= v.arrivalStart) {
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
    everyWeeks: '1',
    count: '',
    careTimes: [],
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

  if (v.service === 'multi_day') {
    return {
      p_service_type: 'multi_day',
      p_pet_ids: v.petIds,
      p_start_date: v.startDate,
      p_end_date: v.endDate,
      p_care_times: v.careTimes
        .map((c) => ({
          care_time: normalizeTime(c.time)!,
          duration_minutes: Number(c.durationMinutes),
          label: c.label.trim(),
        }))
        .sort((a, b) => a.care_time.localeCompare(b.care_time)),
      p_notes: notes,
    };
  }

  const count = v.repeat !== 'once' && v.count !== '' ? Number(v.count) : null;
  const rule =
    v.repeat === 'once'
      ? undefined
      : buildRecurrenceRule({
          freq: v.repeat === 'daily' ? 'DAILY' : 'WEEKLY',
          interval: v.repeat === 'weekly' ? Number(v.everyWeeks) : 1,
          byDay:
            v.repeat === 'weekdays'
              ? ['MO', 'TU', 'WE', 'TH', 'FR']
              : v.repeat === 'weekly'
                ? v.days
                : [],
          until: null,
          count,
        });

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

type PetCareTimes = {
  feeding_plans: readonly { times: readonly string[] }[];
  pet_medications: readonly { schedule_times: readonly string[] }[];
};

/**
 * Suggested care times for a multi-day stay: one per feeding or medication time of
 * the chosen pets (wall-clock), or morning and evening care when they have none.
 */
export function defaultCareTimes(pets: readonly PetCareTimes[]): CareTimeValues[] {
  const tasks = new Map<string, Set<string>>();
  const add = (time: string, task: string) => {
    const t = normalizeTime(time.slice(0, 5));
    if (!t) return;
    if (!tasks.has(t)) tasks.set(t, new Set());
    tasks.get(t)!.add(task);
  };
  for (const pet of pets) {
    for (const plan of pet.feeding_plans) plan.times.forEach((t) => add(t, 'Feed'));
    for (const med of pet.pet_medications) med.schedule_times.forEach((t) => add(t, 'meds'));
  }
  if (tasks.size === 0) {
    return [
      { time: '08:00', label: 'Morning care', durationMinutes: '30' },
      { time: '18:00', label: 'Evening care', durationMinutes: '30' },
    ];
  }
  return [...tasks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, MAX_CARE_TIMES)
    .map(([time, set]) => {
      const label = [...set].join(' + ');
      return {
        time,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        durationMinutes: '30',
      };
    });
}
