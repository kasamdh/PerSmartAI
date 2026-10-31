import { pushSupport } from '../push';
import { visitRouteFor } from '../push-routes';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

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
