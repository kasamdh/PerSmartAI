import {
  buildSitterBookingAlert,
  buildVisitAlert,
  type VisitAlertContext,
} from '../../../../../../supabase/functions/_shared/push-messages';

const ctx: VisitAlertContext = {
  sitterName: 'Monika Pokhrel',
  petNames: ['Max'],
  place: 'Lee home',
  service: 'walk',
  startLabel: 'Tue, Nov 10, 11:00 AM',
  timeLabel: (iso) => (iso === '2026-11-10T01:00:00.000Z' ? '8:00 PM' : iso),
};

describe('buildVisitAlert', () => {
  it('batches photos: "Max: 4 new photos"', () => {
    expect(
      buildVisitAlert(
        { type: 'visit_photos', visit_id: 'v1', count: 4, has_video: false },
        ctx,
        'owner',
      ),
    ).toEqual({
      kind: 'new_photos',
      title: 'Max: 4 new photos',
      body: 'From Monika. Tap to see them.',
      data: { type: 'visit_photos', visitId: 'v1' },
    });
    expect(
      buildVisitAlert(
        { type: 'visit_photos', visit_id: 'v1', count: 1, has_video: false },
        ctx,
        'owner',
      )?.title,
    ).toBe('Max: 1 new photo');
    expect(
      buildVisitAlert(
        { type: 'visit_photos', visit_id: 'v1', count: 3, has_video: true },
        ctx,
        'owner',
      )?.title,
    ).toBe('Max: 3 new photos and videos');
  });

  it('warns owners and admins differently about a late check-in', () => {
    expect(buildVisitAlert({ type: 'late_check_in', visit_id: 'v1' }, ctx, 'owner')).toMatchObject({
      kind: 'late_check_in',
      title: 'Your sitter hasn’t checked in yet',
      body: 'The walk for Max (Tue, Nov 10, 11:00 AM) hasn’t started. The business is on it.',
    });
    expect(buildVisitAlert({ type: 'late_check_in', visit_id: 'v1' }, ctx, 'admin')).toMatchObject({
      kind: 'late_check_in',
      title: 'Late check-in: Lee home',
      body: 'Monika hasn’t checked in for the walk at Tue, Nov 10, 11:00 AM (15+ min late).',
    });
    expect(
      buildVisitAlert(
        { type: 'late_check_in', visit_id: 'v1' },
        { ...ctx, sitterName: null },
        'admin',
      )?.body,
    ).toBe('Nobody is assigned to the walk at Tue, Nov 10, 11:00 AM.');
  });

  it('tells sitters about assignments, changes, cancellations and reminders', () => {
    const sitter = (type: Parameters<typeof buildVisitAlert>[0]['type']) =>
      buildVisitAlert({ type, visit_id: 'v1' } as never, ctx, 'sitter');
    expect(sitter('visit_assigned')).toMatchObject({
      kind: 'visit_assigned',
      title: 'New visit: walk at Lee home',
      body: 'Tue, Nov 10, 11:00 AM with Max.',
    });
    expect(sitter('visit_unassigned')).toMatchObject({
      kind: 'visit_changed',
      title: 'Visit reassigned',
      body: 'The walk at Lee home (Tue, Nov 10, 11:00 AM) is no longer yours.',
    });
    expect(sitter('visit_changed')).toMatchObject({
      kind: 'visit_changed',
      title: 'Visit time changed',
      body: 'The walk at Lee home is now Tue, Nov 10, 11:00 AM.',
    });
    expect(sitter('visit_cancelled')).toMatchObject({
      kind: 'visit_changed',
      title: 'Visit cancelled',
    });
    expect(sitter('visit_reminder')).toMatchObject({
      kind: 'visit_reminder',
      title: 'In 30 minutes: walk at Lee home',
      body: 'Tue, Nov 10, 11:00 AM with Max. Tap for the address and care notes.',
    });
  });

  it('reminds sitters of medication during a stay', () => {
    expect(
      buildVisitAlert(
        {
          type: 'medication_due',
          visit_id: 'v1',
          pet_name: 'Max',
          title: 'Apoquel 16 mg',
          due_at: '2026-11-10T01:00:00.000Z',
        },
        ctx,
        'sitter',
      ),
    ).toMatchObject({
      kind: 'medication_due',
      title: 'Medication due: Max',
      body: 'Apoquel 16 mg at 8:00 PM. Mark it given or skipped in the visit.',
    });
  });

  it('flags a pet that stopped eating', () => {
    expect(
      buildVisitAlert(
        { type: 'food_refused', visit_id: 'v1', pet_id: 'p', pet_name: 'Max' },
        ctx,
        'owner',
      ),
    ).toMatchObject({
      kind: 'food_refused',
      title: 'Max isn’t eating',
      body: 'Max ate nothing at the last 2 meals. Monika is keeping an eye on it.',
    });
    expect(
      buildVisitAlert(
        { type: 'food_refused', visit_id: 'v1', pet_id: 'p', pet_name: 'Max' },
        ctx,
        'admin',
      )?.body,
    ).toBe('Max (Lee home) ate nothing at the last 2 meals, logged by Monika.');
  });

  it('only builds messages meant for that audience', () => {
    expect(buildVisitAlert({ type: 'visit_reminder', visit_id: 'v1' }, ctx, 'owner')).toBeNull();
    expect(
      buildVisitAlert(
        { type: 'visit_photos', visit_id: 'v1', count: 2, has_video: false },
        ctx,
        'sitter',
      ),
    ).toBeNull();
  });
});

describe('buildSitterBookingAlert', () => {
  const booking = { petNames: ['Max'], serviceType: 'walk' as const, startDate: '2026-11-16' };

  it('tells sitters about bookings assigned, taken away, or changed', () => {
    expect(
      buildSitterBookingAlert(
        { type: 'booking_assigned', booking_id: 'b1', sitter_id: 's1' },
        booking,
      ),
    ).toEqual({
      kind: 'visit_assigned',
      title: 'New booking for you',
      body: 'Walk for Max, starting Nov 16. It’s on your schedule.',
      data: { type: 'booking_assigned', bookingId: 'b1' },
    });
    expect(
      buildSitterBookingAlert(
        { type: 'booking_unassigned', booking_id: 'b1', sitter_id: 's1' },
        booking,
      ),
    ).toMatchObject({ kind: 'visit_changed', title: 'Booking reassigned' });
    expect(
      buildSitterBookingAlert(
        { type: 'booking_changed', booking_id: 'b1', sitter_id: 's1' },
        booking,
      ),
    ).toMatchObject({ kind: 'visit_changed', title: 'Booking changed' });
  });
});
