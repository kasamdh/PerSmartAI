import type { Href } from 'expo-router';

import type { AppRole } from '@/types/models';

/**
 * Pet detail for each role. Each role's route group has its own copy of the
 * screen (only the current role's group exists), so the paths differ.
 */
export function petRouteFor(role: AppRole, petId: string): Href {
  switch (role) {
    case 'owner':
      return { pathname: '/pets/[id]', params: { id: petId } };
    case 'sitter':
      return { pathname: '/sitter-pet/[id]', params: { id: petId } };
    case 'admin':
      return { pathname: '/admin-pet/[id]', params: { id: petId } };
  }
}

export type PetEditSection = 'edit' | 'allergies' | 'medications' | 'feeding';

/** Owner-only edit screens. */
export function petEditRoute(petId: string, section: PetEditSection): Href {
  return { pathname: `/pets/[id]/${section}`, params: { id: petId } } as Href;
}
