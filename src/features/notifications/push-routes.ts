import type { Href } from 'expo-router';

import type { AppRole } from '@/types/models';

/** Where tapping a notification about `visitId` should take this user. */
export function visitRouteFor(role: AppRole, visitId: string): Href {
  switch (role) {
    case 'sitter':
      return { pathname: '/visit/[id]', params: { id: visitId } };
    case 'owner':
      return { pathname: '/visits/[id]', params: { id: visitId } };
    case 'admin':
      return { pathname: '/visit-overview/[id]', params: { id: visitId } };
  }
}
