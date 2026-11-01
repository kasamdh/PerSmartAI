import { resolveDestination, routeGuards, type RoutingState } from '../routing';

const signedIn = (overrides: Partial<RoutingState> = {}): RoutingState => ({
  signedIn: true,
  recoveringPassword: false,
  profile: undefined,
  ownerHasHousehold: undefined,
  ...overrides,
});

const signedOut: RoutingState = {
  signedIn: false,
  recoveringPassword: false,
  profile: undefined,
  ownerHasHousehold: undefined,
};

describe('resolveDestination', () => {
  it('sends signed-out users to the welcome screen', () => {
    expect(resolveDestination(signedOut)).toEqual({ kind: 'redirect', href: '/welcome' });
  });

  it('holds password-recovery sessions on the reset screen, whatever their role', () => {
    expect(
      resolveDestination(signedIn({ recoveringPassword: true, profile: { role: 'admin' } })),
    ).toEqual({ kind: 'redirect', href: '/reset-password' });
  });

  it('waits for the profile, and reports load errors', () => {
    expect(resolveDestination(signedIn())).toEqual({ kind: 'loading' });
    expect(resolveDestination(signedIn({ profile: 'error' }))).toEqual({ kind: 'error' });
  });

  it('shows "not set up" for accounts without a profile', () => {
    expect(resolveDestination(signedIn({ profile: null }))).toEqual({ kind: 'not-set-up' });
  });

  it.each([
    ['sitter', '/sitter'],
    ['admin', '/admin'],
  ] as const)('sends a %s to %s', (role, href) => {
    expect(resolveDestination(signedIn({ profile: { role }, adminTwoStep: 'done' }))).toEqual({
      kind: 'redirect',
      href,
    });
  });

  it('sends owners without a household to finish their profile first', () => {
    const owner = { role: 'owner' as const };
    expect(resolveDestination(signedIn({ profile: owner }))).toEqual({ kind: 'loading' });
    expect(resolveDestination(signedIn({ profile: owner, ownerHasHousehold: false }))).toEqual({
      kind: 'redirect',
      href: '/complete-profile',
    });
    expect(resolveDestination(signedIn({ profile: owner, ownerHasHousehold: true }))).toEqual({
      kind: 'redirect',
      href: '/owner',
    });
    expect(resolveDestination(signedIn({ profile: owner, ownerHasHousehold: 'error' }))).toEqual({
      kind: 'error',
    });
  });
});

describe('routeGuards', () => {
  const open = (state: RoutingState) =>
    Object.entries(routeGuards(state))
      .filter(([, isOpen]) => isOpen)
      .map(([group]) => group)
      .sort();

  it('opens only the auth screens when signed out', () => {
    expect(open(signedOut)).toEqual(['auth']);
  });

  it('opens nothing role-specific while the profile loads or is missing', () => {
    expect(open(signedIn())).toEqual([]);
    expect(open(signedIn({ profile: null }))).toEqual([]);
    expect(open(signedIn({ profile: 'error' }))).toEqual([]);
  });

  it("opens exactly one role's screens, plus the account screens", () => {
    expect(open(signedIn({ profile: { role: 'sitter' } }))).toEqual(['account', 'sitter']);
    expect(open(signedIn({ profile: { role: 'admin' }, adminTwoStep: 'done' }))).toEqual([
      'account',
      'admin',
    ]);
    expect(open(signedIn({ profile: { role: 'owner' }, ownerHasHousehold: true }))).toEqual([
      'account',
      'owner',
    ]);
  });

  it('keeps owners in onboarding until their household exists', () => {
    expect(open(signedIn({ profile: { role: 'owner' }, ownerHasHousehold: false }))).toEqual([
      'account',
      'ownerOnboarding',
    ]);
    expect(open(signedIn({ profile: { role: 'owner' } }))).toEqual(['account']);
  });

  it('allows only the reset screen during password recovery', () => {
    expect(open(signedIn({ recoveringPassword: true, profile: { role: 'admin' } }))).toEqual([
      'resetPassword',
    ]);
  });

  it('never opens two role groups at once', () => {
    const roleGroups = ['owner', 'ownerOnboarding', 'sitter', 'admin'] as const;
    for (const role of ['owner', 'sitter', 'admin'] as const) {
      for (const ownerHasHousehold of [true, false, undefined]) {
        const guards = routeGuards(
          signedIn({ profile: { role }, ownerHasHousehold, adminTwoStep: 'done' }),
        );
        expect(roleGroups.filter((g) => guards[g]).length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('admin two-step sign-in', () => {
  const admin = (adminTwoStep: RoutingState['adminTwoStep']) =>
    signedIn({ profile: { role: 'admin' }, adminTwoStep });

  it('sends admins to the two-step screen until the session is verified', () => {
    expect(resolveDestination(admin(undefined))).toEqual({ kind: 'loading' });
    expect(resolveDestination(admin('needed'))).toEqual({ kind: 'redirect', href: '/two-step' });
    expect(resolveDestination(admin('done'))).toEqual({ kind: 'redirect', href: '/admin' });
  });

  it('opens only the two-step screen before the second step, and no admin or account screens', () => {
    const guards = routeGuards(admin('needed'));
    expect(
      Object.entries(guards)
        .filter(([, on]) => on)
        .map(([g]) => g),
    ).toEqual(['twoStep']);
    expect(Object.values(routeGuards(admin(undefined))).some(Boolean)).toBe(false);
  });

  it('never asks owners or sitters for a second step', () => {
    expect(routeGuards(signedIn({ profile: { role: 'sitter' } })).twoStep).toBe(false);
    expect(resolveDestination(signedIn({ profile: { role: 'sitter' } }))).toEqual({
      kind: 'redirect',
      href: '/sitter',
    });
  });
});
