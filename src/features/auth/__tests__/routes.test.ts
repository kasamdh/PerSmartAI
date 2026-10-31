import { homeRouteForRole } from '../routes';

describe('homeRouteForRole', () => {
  it.each([
    ['owner', '/owner'],
    ['sitter', '/sitter'],
    ['admin', '/admin'],
  ] as const)('sends %s to %s', (role, route) => {
    expect(homeRouteForRole(role)).toBe(route);
  });
});
