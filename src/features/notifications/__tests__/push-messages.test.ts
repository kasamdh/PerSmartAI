import {
  bookingRecipients,
  buildBookingPushMessage,
  buildPushMessage,
  joinNames,
  shortDate,
  type BookingPushContext,
} from '../../../../supabase/functions/_shared/push-messages';

const ctx = { sitterName: 'Monika Pokhrel', petNames: ['Biscuit', 'Mochi'] };

describe('joinNames', () => {
  it('reads naturally for any number of pets', () => {
    expect(joinNames([])).toBe('your pets');
    expect(joinNames(['Rex'])).toBe('Rex');
    expect(joinNames(['Biscuit', 'Mochi'])).toBe('Biscuit & Mochi');
    expect(joinNames(['Biscuit', 'Mochi', 'Rex'])).toBe('Biscuit, Mochi & Rex');
  });
});

describe('buildPushMessage', () => {
  const status = (s: string) =>
    buildPushMessage({ type: 'visit_status', visit_id: 'v1', status: s }, ctx);

  it('announces the sitter heading over, checking in, and finishing', () => {
    expect(status('on_the_way')?.title).toBe('Monika is on the way');
    expect(status('arrived')).toEqual({
      title: 'Monika checked in',
      body: 'Biscuit & Mochi are in good hands.',
      data: { visitId: 'v1', type: 'visit_status' },
    });
    expect(status('completed')).toMatchObject({
      title: 'Report card ready',
      body: 'Monika checked out. See how Biscuit & Mochi did.',
    });
  });

  it('uses singular grammar for one pet', () => {
    const msg = buildPushMessage(
      { type: 'visit_status', visit_id: 'v1', status: 'arrived' },
      { sitterName: 'Sky', petNames: ['Rex'] },
    );
    expect(msg?.body).toBe('Rex is in good hands.');
  });

  it('stays quiet for statuses owners do not need pinged about', () => {
    expect(status('scheduled')).toBeNull();
    expect(status('in_progress')).toBeNull();
    expect(status('missed')).toBeNull();
  });

  it('announces photos and incidents, linking to the visit', () => {
    const photo = buildPushMessage({ type: 'visit_photo', visit_id: 'v2', media_id: 'm1' }, ctx);
    expect(photo).toMatchObject({ title: 'New photo of Biscuit & Mochi', data: { visitId: 'v2' } });

    const incident = buildPushMessage(
      { type: 'incident', visit_id: 'v3', incident_id: 'i1' },
      { sitterName: null, petNames: [] },
    );
    expect(incident?.body).toBe(
      'Your sitter reported an incident with your pets. Tap for details.',
    );
  });
});

describe('booking notifications', () => {
  const bctx: BookingPushContext = {
    ownerName: 'Oscar Owner',
    sitterName: 'Sky Sitter',
    petNames: ['Rex'],
    serviceType: 'walk',
    startDate: '2026-11-03',
    cancelledByOwner: true,
  };

  it('formats booking dates without shifting time zones', () => {
    expect(shortDate('2026-11-03')).toBe('Nov 3');
    expect(shortDate('2027-01-31')).toBe('Jan 31');
  });

  it('tells admins who asked for what', () => {
    expect(buildBookingPushMessage({ type: 'booking_requested', booking_id: 'b1' }, bctx)).toEqual({
      title: 'New booking request',
      body: 'Oscar Owner wants a walk for Rex starting Nov 3.',
      data: { bookingId: 'b1', type: 'booking_requested' },
    });
  });

  it('tells the owner about confirmation with the sitter, or a decline', () => {
    const confirmed = buildBookingPushMessage(
      { type: 'booking_status', booking_id: 'b1', status: 'confirmed' },
      bctx,
    );
    expect(confirmed.title).toBe('Booking confirmed');
    expect(confirmed.body).toBe('Sky will look after Rex. Your walk starts Nov 3.');

    const declined = buildBookingPushMessage(
      { type: 'booking_status', booking_id: 'b1', status: 'declined' },
      { ...bctx, serviceType: 'overnight', petNames: ['Rex', 'Mo'] },
    );
    expect(declined.title).toBe('Booking request declined');
    expect(declined.body).toMatch(/overnight stay for Rex & Mo starting Nov 3/);
  });

  it('says who cancelled', () => {
    const event = { type: 'booking_cancelled', booking_id: 'b1', actor_id: 'o1' } as const;
    expect(buildBookingPushMessage(event, bctx).body).toBe(
      'Oscar Owner cancelled the walk for Rex from Nov 3. Upcoming visits are off the schedule.',
    );
    expect(buildBookingPushMessage(event, { ...bctx, cancelledByOwner: false }).body).toMatch(
      /^The business cancelled/,
    );
  });
});

describe('bookingRecipients', () => {
  const people = { ownerId: 'o1', adminIds: ['a1', 'a2'], sitterIds: ['s1', 's2', 's1'] };

  it('sends requests to admins and decisions to the owner', () => {
    expect(bookingRecipients({ type: 'booking_requested', booking_id: 'b1' }, people)).toEqual([
      'a1',
      'a2',
    ]);
    expect(
      bookingRecipients({ type: 'booking_status', booking_id: 'b1', status: 'declined' }, people),
    ).toEqual(['o1']);
  });

  it('sends cancellations to sitters, admins, and owner, except whoever cancelled', () => {
    expect(
      bookingRecipients({ type: 'booking_cancelled', booking_id: 'b1', actor_id: 'o1' }, people),
    ).toEqual(['s1', 's2', 'a1', 'a2']);
    expect(
      bookingRecipients({ type: 'booking_cancelled', booking_id: 'b1', actor_id: 'a1' }, people),
    ).toEqual(['s1', 's2', 'a2', 'o1']);
  });
});
