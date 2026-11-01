import { pushSupport } from '../push';
import { pushRouteFor, visitRouteFor } from '../push-routes';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('pushSupport', () => {
  const device = { isDevice: true, inExpoGo: false, platform: 'android', projectId: 'proj-1' };

  it('is supported on a real device in a development or store build', () => {
    expect(pushSupport(device)).toEqual({ supported: true, projectId: 'proj-1' });
    expect(pushSupport({ ...device, platform: 'ios', inExpoGo: true })).toEqual({
      supported: true,
      projectId: 'proj-1',
    });
  });

  it.each([
    ['simulators', { isDevice: false }, /physical device/],
    ['Expo Go on Android', { inExpoGo: true }, /development build/],
    ['builds without an EAS project id', { projectId: undefined }, /eas-cli init/],
    ['web', { platform: 'web' }, /web/],
  ])('is not supported for %s', (_label, override, reason) => {
    const result = pushSupport({ ...device, ...override });
    expect(result.supported).toBe(false);
    expect(result.supported ? '' : result.reason).toMatch(reason);
  });
});

describe('visitRouteFor', () => {
  it("opens the right visit screen for the user's role", () => {
    expect(visitRouteFor('sitter', 'v1')).toEqual({
      pathname: '/visit/[id]',
      params: { id: 'v1' },
    });
    expect(visitRouteFor('owner', 'v1')).toEqual({
      pathname: '/visits/[id]',
      params: { id: 'v1' },
    });
    expect(visitRouteFor('admin', 'v1')).toEqual({
      pathname: '/visit-overview/[id]',
      params: { id: 'v1' },
    });
  });
});

describe('pushRouteFor', () => {
  it('opens visits from visit notifications', () => {
    expect(pushRouteFor('owner', { visitId: 'v1', type: 'visit_photo' })).toEqual({
      pathname: '/visits/[id]',
      params: { id: 'v1' },
    });
  });

  it('opens the request for admins, and bookings or schedule for others', () => {
    const requested = { bookingId: 'b1', type: 'booking_requested' };
    expect(pushRouteFor('admin', requested)).toEqual({
      pathname: '/bookings/[id]',
      params: { id: 'b1' },
    });
    expect(pushRouteFor('admin', { bookingId: 'b1', type: 'booking_cancelled' })).toBe('/admin');
    expect(pushRouteFor('owner', { bookingId: 'b1', type: 'booking_status' })).toBe('/my-bookings');
    expect(pushRouteFor('sitter', { bookingId: 'b1', type: 'booking_cancelled' })).toBe('/sitter');
  });

  it('opens the visit for reminders, assignments, medication, late check-ins and food alerts', () => {
    for (const type of ['visit_reminder', 'visit_assigned', 'visit_changed', 'medication_due']) {
      expect(pushRouteFor('sitter', { visitId: 'v1', type })).toEqual({
        pathname: '/visit/[id]',
        params: { id: 'v1' },
      });
    }
    expect(pushRouteFor('owner', { visitId: 'v1', type: 'late_check_in' })).toEqual({
      pathname: '/visits/[id]',
      params: { id: 'v1' },
    });
    expect(pushRouteFor('admin', { visitId: 'v1', type: 'food_refused' })).toEqual({
      pathname: '/visit-overview/[id]',
      params: { id: 'v1' },
    });
  });

  it('sends sitters to their schedule when a visit or booking was taken away', () => {
    expect(pushRouteFor('sitter', { visitId: 'v1', type: 'visit_unassigned' })).toBe('/sitter');
    expect(pushRouteFor('sitter', { visitId: 'v1', type: 'visit_cancelled' })).toBe('/sitter');
    expect(pushRouteFor('sitter', { bookingId: 'b1', type: 'booking_assigned' })).toBe(
      '/sitter-week',
    );
    expect(pushRouteFor('sitter', { bookingId: 'b1', type: 'booking_changed' })).toBe(
      '/sitter-week',
    );
    expect(pushRouteFor('sitter', { bookingId: 'b1', type: 'booking_unassigned' })).toBe(
      '/sitter-week',
    );
  });

  it('opens the conversation from a message alert, for every role', () => {
    for (const role of ['owner', 'sitter', 'admin'] as const) {
      expect(pushRouteFor(role, { type: 'message', householdId: 'h1' })).toEqual({
        pathname: '/messages/[householdId]',
        params: { householdId: 'h1' },
      });
    }
  });

  it('ignores payloads it does not understand', () => {
    expect(pushRouteFor('owner', undefined)).toBeNull();
    expect(pushRouteFor('owner', { bookingId: 'b1' })).toBeNull();
    expect(pushRouteFor('owner', { visitId: 42 })).toBeNull();
  });
});
