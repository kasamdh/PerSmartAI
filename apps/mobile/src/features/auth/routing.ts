import type { Href } from 'expo-router';

import type { AppRole } from '@/types/models';

import { homeRouteForRole } from './routes';

/** Everything routing depends on. `undefined` means still loading. */
export type RoutingState = {
  signedIn: boolean;
  /** Signed in from a password-reset code/link; must set a new password first. */
  recoveringPassword: boolean;
  /** null = signed in but no profile; 'error' = couldn't load. */
  profile: { role: AppRole } | null | 'error' | undefined;
  /** Owners only: whether they've added their household. */
  ownerHasHousehold: boolean | 'error' | undefined;
  /**
   * Admins only: whether this session passed two-step sign-in (aal2). The database
   * grants admin access only then, so admins finish it before anything else.
   */
  adminTwoStep?: 'done' | 'needed' | undefined;
};

export type Destination =
  | { kind: 'redirect'; href: Href }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not-set-up' };

/** Where the app entry point (`/`) sends this user. */
export function resolveDestination(state: RoutingState): Destination {
  if (!state.signedIn) return { kind: 'redirect', href: '/welcome' };
  if (state.recoveringPassword) return { kind: 'redirect', href: '/reset-password' };
  if (state.profile === undefined) return { kind: 'loading' };
  if (state.profile === 'error') return { kind: 'error' };
  if (state.profile === null) return { kind: 'not-set-up' };

  if (state.profile.role === 'admin') {
    if (state.adminTwoStep === undefined) return { kind: 'loading' };
    if (state.adminTwoStep === 'needed') return { kind: 'redirect', href: '/two-step' };
  }
  if (state.profile.role === 'owner') {
    if (state.ownerHasHousehold === undefined) return { kind: 'loading' };
    if (state.ownerHasHousehold === 'error') return { kind: 'error' };
    if (!state.ownerHasHousehold) return { kind: 'redirect', href: '/complete-profile' };
  }
  return { kind: 'redirect', href: homeRouteForRole(state.profile.role) };
}

export type RouteGuards = {
  auth: boolean;
  resetPassword: boolean;
  owner: boolean;
  ownerOnboarding: boolean;
  sitter: boolean;
  admin: boolean;
  /** Admins who still need their second sign-in step. */
  twoStep: boolean;
  account: boolean;
};

/**
 * Which route groups exist right now. A group whose guard is false can't be
 * opened at all (deep links included), so users never reach other roles' screens.
 */
export function routeGuards(state: RoutingState): RouteGuards {
  const ready = state.signedIn && !state.recoveringPassword;
  const role = ready && state.profile && state.profile !== 'error' ? state.profile.role : null;
  const adminReady = role === 'admin' && state.adminTwoStep === 'done';
  const adminPending = role === 'admin' && !adminReady;

  return {
    auth: !state.signedIn,
    resetPassword: state.signedIn && state.recoveringPassword,
    owner: role === 'owner' && state.ownerHasHousehold === true,
    ownerOnboarding: role === 'owner' && state.ownerHasHousehold === false,
    sitter: role === 'sitter',
    admin: adminReady,
    twoStep: role === 'admin' && state.adminTwoStep === 'needed',
    account: role !== null && !adminPending,
  };
}
