import { useQuery } from '@tanstack/react-query';

import { fetchProfile } from './api';
import { useAuth } from './auth-provider';

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
}
