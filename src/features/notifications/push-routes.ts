import type { Href } from 'expo-router';

import type { AppRole } from '@/types/models';

/** Where tapping a notification about `visitId` should take this user (null: nowhere yet). */
export function visitRouteFor(role: AppRole, visitId: string): Href | null {
  switch (role) {
    case 'sitter':
      return { pathname: '/visit/[id]', params: { id: visitId } };
    case 'owner':
      return { pathname: '/visits/[id]', params: { id: visitId } };
    case 'admin':
      return null; // admin visit screens don't exist yet
  }
}
