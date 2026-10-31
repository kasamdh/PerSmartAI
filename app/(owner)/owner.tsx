import { Stack } from 'expo-router';

import { RoleHome } from '@/features/auth/role-home';

export default function OwnerHomeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Owner home' }} />
      <RoleHome heading="Your pets and visits" />
    </>
  );
}
