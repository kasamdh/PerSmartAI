import {
  ALERT_KINDS,
  alertKindsFor,
  allowedRecipients,
  decidePhotoAlert,
  lateCheckIns,
  medicationsDue,
  PHOTO_ALERT_GAP_MS,
  PHOTO_SETTLE_MS,
  visitReminders,
} from '../../../../supabase/functions/_shared/alerts';

const t = (iso: string) => new Date(iso);
const min = 60_000;

describe('decidePhotoAlert (batching)', () => {
  const now = t('2026-11-10T16:10:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('waits for a burst to settle, then sends one alert with the count', () => {
    // Four photos sent seconds apart; the last one just now.
    const burst = [ago(40_000), ago(30_000), ago(20_000), ago(5_000)];
    expect(decidePhotoAlert({ unsent: burst, lastAlertAt: null, now })).toEqual({
      send: false,
      retryAt: new Date(burst[3].getTime() + PHOTO_SETTLE_MS),
    });
    const later = new Date(now.getTime() + PHOTO_SETTLE_MS);
    expect(decidePhotoAlert({ unsent: burst, lastAlertAt: null, now: later })).toEqual({
      send: true,
      count: 4,
      coveredUntil: burst[3],
    });
  });

  it('sends at most one alert per 5 minutes per visit', () => {
    const unsent = [ago(2 * min)];
    expect(decidePhotoAlert({ unsent, lastAlertAt: ago(3 * min), now })).toEqual({
      send: false,
      retryAt: new Date(now.getTime() + 2 * min),
    });
    expect(decidePhotoAlert({ unsent, lastAlertAt: ago(5 * min), now })).toMatchObject({
      send: true,
      count: 1,
    });
  });

  it('does not wait forever while photos keep arriving', () => {
    // A new photo every 20 s for 6 minutes: the burst never settles.
    const unsent = Array.from({ length: 18 }, (_, i) => ago((18 - i) * 20_000));
    expect(decidePhotoAlert({ unsent, lastAlertAt: null, now })).toEqual({
      send: true,
      count: 18,
      coveredUntil: unsent[17],
    });
  });

  it('has nothing to do without new photos', () => {
    expect(decidePhotoAlert({ unsent: [], lastAlertAt: null, now })).toEqual({
      send: false,
      retryAt: null,
    });
  });

  it('uses a 5 minute gap and a 30 second settle', () => {
    expect(PHOTO_ALERT_GAP_MS).toBe(5 * min);
    expect(PHOTO_SETTLE_MS).toBe(30_000);
  });
});

describe('lateCheckIns', () => {
  const visit = (id: string, start: string, extra: Record<string, unknown> = {}) => ({
    id,
    status: 'scheduled',
    scheduled_start: start,
    scheduled_end: new Date(Date.parse(start) + 30 * min).toISOString(),
    check_in_at: null as string | null,
    ...extra,
  });
  const now = t('2026-11-10T16:20:00Z');

  it('flags visits not checked in 15 minutes after the window start', () => {
    const visits = [
      visit('late', '2026-11-10T16:05:00Z'), // 15 min ago: exactly late
      visit('on-way', '2026-11-10T15:50:00Z', { status: 'on_the_way' }),
      visit('grace', '2026-11-10T16:06:00Z'), // 14 min: not yet
      visit('in', '2026-11-10T15:50:00Z', {
        status: 'arrived',
        check_in_at: '2026-11-10T16:00:00Z',
      }),
      visit('cancelled', '2026-11-10T15:50:00Z', { status: 'cancelled' }),
      visit('future', '2026-11-10T17:00:00Z'),
    ];
    expect(lateCheckIns(visits, now, new Set()).map((v) => v.id)).toEqual(['late', 'on-way']);
  });

  it('alerts once per visit', () => {
    const visits = [visit('late', '2026-11-10T16:00:00Z')];
    expect(lateCheckIns(visits, now, new Set(['late']))).toEqual([]);
  });

  it('ignores visits long past, e.g. after the job was down', () => {
    expect(lateCheckIns([visit('old', '2026-11-10T12:00:00Z')], now, new Set())).toEqual([]);
  });
});

describe('visitReminders', () => {
  const now = t('2026-11-10T16:00:00Z');
  const visit = (id: string, start: string, extra: Record<string, unknown> = {}) => ({
    id,
    status: 'scheduled',
    sitter_id: 's1',
    scheduled_start: start,
    ...extra,
  });

  it('reminds the sitter once, in the 30 minutes before each visit', () => {
    const visits = [
      visit('soon', '2026-11-10T16:30:00Z'),
      visit('very-soon', '2026-11-10T16:04:00Z'),
      visit('later', '2026-11-10T16:31:00Z'),
      visit('started', '2026-11-10T15:59:00Z'),
      visit('on-way', '2026-11-10T16:20:00Z', { status: 'on_the_way' }),
      visit('no-sitter', '2026-11-10T16:20:00Z', { sitter_id: null }),
      visit('sent', '2026-11-10T16:10:00Z'),
    ];
    expect(visitReminders(visits, now, new Set(['sent'])).map((v) => v.id)).toEqual([
      'soon',
      'very-soon',
    ]);
  });
});

describe('medicationsDue', () => {
  const NY = 'America/New_York';
  // Overnight stay 7 PM Nov 9 – 8 AM Nov 10 in New York; it's 8:02 PM.
  const stay = {
    id: 'v1',
    status: 'in_progress',
    service_type: 'overnight',
    scheduled_start: '2026-11-10T00:00:00.000Z',
    scheduled_end: '2026-11-10T13:00:00.000Z',
  };
  const pets = [
    {
      id: 'rex',
      name: 'Rex',
      pet_medications: [
        { id: 'm1', name: 'Apoquel', dose: '16 mg', schedule_times: ['20:00:00', '07:00:00'] },
        { id: 'm2', name: 'Fish oil', dose: null, schedule_times: ['19:00:00'] },
      ],
    },
  ];
  const now = t('2026-11-10T01:02:00.000Z'); // 8:02 PM Nov 9

  it('lists medications that just came due and haven’t been given', () => {
    const due = medicationsDue(stay, pets, [], NY, now, new Set());
    expect(due).toEqual([
      {
        key: 'medication:m1:2026-11-10T01:00:00.000Z',
        petId: 'rex',
        petName: 'Rex',
        title: 'Apoquel 16 mg',
        dueAt: '2026-11-10T01:00:00.000Z',
      },
    ]);
  });

  it('skips doses already given or skipped, or already alerted', () => {
    const key = 'medication:m1:2026-11-10T01:00:00.000Z';
    expect(
      medicationsDue(
        stay,
        pets,
        [{ pet_id: 'rex', type: 'meds_given', value: { task_key: key } }],
        NY,
        now,
        new Set(),
      ),
    ).toEqual([]);
    expect(medicationsDue(stay, pets, [], NY, now, new Set([key]))).toEqual([]);
  });

  it('only runs during stays that are under way', () => {
    expect(medicationsDue({ ...stay, status: 'scheduled' }, pets, [], NY, now, new Set())).toEqual(
      [],
    );
    expect(medicationsDue({ ...stay, service_type: 'walk' }, pets, [], NY, now, new Set())).toEqual(
      [],
    );
    expect(
      medicationsDue({ ...stay, service_type: 'multi_day' }, pets, [], NY, now, new Set()),
    ).toHaveLength(1);
  });
});

describe('alert settings', () => {
  it('lists each role’s alert kinds, with incidents always on', () => {
    expect(alertKindsFor('owner').map((k) => k.kind)).toEqual([
      'sitter_on_the_way',
      'sitter_arrived',
      'new_photos',
      'visit_complete',
      'incident',
      'late_check_in',
      'food_refused',
      'messages',
      'booking_updates',
    ]);
    expect(alertKindsFor('sitter').map((k) => k.kind)).toEqual([
      'visit_assigned',
      'visit_changed',
      'visit_reminder',
      'medication_due',
      'messages',
      'booking_updates',
    ]);
    expect(alertKindsFor('admin').map((k) => k.kind)).toEqual([
      'incident',
      'late_check_in',
      'food_refused',
      'booking_request',
      'messages',
      'booking_updates',
    ]);
    expect(ALERT_KINDS.incident.locked).toBe(true);
  });

  it('drops recipients who turned an alert off, but never for incidents', () => {
    const settings = [
      { user_id: 'a', muted: ['new_photos', 'incident'] },
      { user_id: 'b', muted: [] },
    ];
    expect(allowedRecipients(['a', 'b', 'c'], settings, 'new_photos')).toEqual(['b', 'c']);
    expect(allowedRecipients(['a', 'b'], settings, 'incident')).toEqual(['a', 'b']);
  });
});
