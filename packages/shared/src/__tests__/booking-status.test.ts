import { bookingRequestErrorMessage, bookingStatus, canOwnerCancel } from '../booking-status.ts';

describe('bookingStatus', () => {
  it('labels requests as waiting and confirmations as good', () => {
    expect(bookingStatus('requested')).toEqual({
      label: 'Waiting for confirmation',
      tone: 'waiting',
    });
    expect(bookingStatus('confirmed').tone).toBe('good');
    expect(bookingStatus('declined').tone).toBe('bad');
  });
});

describe('canOwnerCancel', () => {
  it('matches what the database allows', () => {
    expect(canOwnerCancel('requested')).toBe(true);
    expect(canOwnerCancel('confirmed')).toBe(true);
    expect(canOwnerCancel('declined')).toBe(false);
    expect(canOwnerCancel('cancelled')).toBe(false);
    expect(canOwnerCancel('completed')).toBe(false);
  });
});

describe('bookingRequestErrorMessage', () => {
  it('passes through the messages request_booking writes for owners', () => {
    expect(
      bookingRequestErrorMessage({ code: '22023', message: 'Bookings can’t start in the past' }),
    ).toBe('Bookings can’t start in the past');
    expect(
      bookingRequestErrorMessage({
        code: 'P0002',
        message: 'Add your home address before booking',
      }),
    ).toBe('Add your home address before booking');
  });

  it('explains a pet from another household', () => {
    expect(bookingRequestErrorMessage({ code: '23514', message: 'raw' })).toMatch(/household/);
  });

  it('hides anything else behind a generic message', () => {
    expect(bookingRequestErrorMessage(new Error('fetch failed'))).toMatch(/connection/);
    expect(bookingRequestErrorMessage({ code: '42501', message: 'permission denied' })).toMatch(
      /connection/,
    );
    expect(bookingRequestErrorMessage(null)).toMatch(/connection/);
  });
});
