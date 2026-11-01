import { useQuery } from '@tanstack/react-query';

import { ownerHasHousehold } from './api';
import { useAuth } from './auth-provider';
import type { RoutingState } from './routing';
import { useProfile } from './use-profile';

export const ownerHouseholdKey = (userId: string | undefined) =>
  ['owner-has-household', userId] as const;

/** Collects what role routing needs: session, recovery mode, profile, and owner household. */
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
    role: profile.data?.role,
  };
}
