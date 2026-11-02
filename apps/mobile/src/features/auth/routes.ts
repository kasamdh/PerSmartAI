import type { Href } from 'expo-router';

import type { AppRole } from '@/types/models';

export const HOME_ROUTE_BY_ROLE = {
  owner: '/owner',
  sitter: '/sitter',
  admin: '/admin',
} as const satisfies Record<AppRole, Href>;

export function homeRouteForRole(role: AppRole): Href {
  return HOME_ROUTE_BY_ROLE[role];
}
