import { useQuery } from '@tanstack/react-query';

import { ownerHasHousehold } from './api';
import { useAuth } from './auth-provider';
import type { RoutingState } from './routing';
import { sessionAal } from './session-aal';
import { useProfile } from './use-profile';

export const ownerHouseholdKey = (userId: string | undefined) =>
  ['owner-has-household', userId] as const;

/**
 * Collects what role routing needs: session, recovery mode, profile, owner
 * household, and (admins) whether this session passed two-step sign-in.
 */
export function useRoutingState(): RoutingState & { role: string | undefined } {
  const { session, recoveringPassword } = useAuth();
  const profile = useProfile();
  const userId = session?.user.id;
  const isOwner = profile.data?.role === 'owner';

  const household = useQuery({
    queryKey: ownerHouseholdKey(userId),
    queryFn: () => ownerHasHousehold(userId!),
    enabled: !!userId && isOwner,
  });

  return {
    signedIn: !!session,
    recoveringPassword,
    profile: !session
      ? undefined
      : profile.isError
        ? 'error'
        : profile.isPending
          ? undefined
          : profile.data
            ? { role: profile.data.role }
            : null,
    ownerHasHousehold: !isOwner
      ? undefined
      : household.isError
        ? 'error'
        : household.isPending
          ? undefined
          : household.data,
    adminTwoStep:
      profile.data?.role !== 'admin'
        ? undefined
        : sessionAal(session?.access_token) === 'aal2'
          ? 'done'
          : 'needed',
    role: profile.data?.role,
  };
}
