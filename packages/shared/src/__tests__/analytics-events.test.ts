import { delayBucket, eventProperties, visitMinutes } from '../analytics-events.ts';

describe('eventProperties', () => {
  it('keeps the allowed properties', () => {
    expect(
      eventProperties('booking_created', { service_type: 'walk', pet_count: 2, recurring: true }),
    ).toEqual({ service_type: 'walk', pet_count: 2, recurring: true });
  });

  it('drops anything personal or unexpected, even if passed by mistake', () => {
    const props = eventProperties('visit_completed', {
      service_type: 'drop_in',
      duration_minutes: 33,
      photo_count: 4,
      care_event_count: 6,
      address_line1: '12 Oak St',
      owner_name: 'Ana Lee',
      household_id: 'h1',
      note: 'Max was shy',
    });
    expect(props).toEqual({
      service_type: 'drop_in',
      duration_minutes: 35,
      photo_count: 4,
      care_event_count: 6,
    });
  });

  it('rejects values outside each rule (no free text in enum fields)', () => {
    expect(
      eventProperties('photo_sent', { media_type: 'Ana at 12 Oak St', delay_bucket: 'under_1m' }),
    ).toEqual({ delay_bucket: 'under_1m' });
    expect(
      eventProperties('booking_created', { service_type: 'walk', pet_count: -3, recurring: 'yes' }),
    ).toEqual({ service_type: 'walk', pet_count: 0 });
  });
});

describe('delayBucket', () => {
  it('buckets the offline delay', () => {
    const at = new Date('2026-11-02T12:00:00Z');
    expect(delayBucket('2026-11-02T11:59:30Z', at)).toBe('under_1m');
    expect(delayBucket('2026-11-02T11:55:00Z', at)).toBe('under_10m');
    expect(delayBucket('2026-11-02T11:30:00Z', at)).toBe('under_1h');
    expect(delayBucket('2026-11-02T09:00:00Z', at)).toBe('over_1h');
  });
});

it('measures check-in to check-out', () => {
  expect(visitMinutes('2026-11-02T12:00:00Z', new Date('2026-11-02T12:31:20Z'))).toBe(31);
  expect(visitMinutes(null, new Date())).toBe(0);
});
