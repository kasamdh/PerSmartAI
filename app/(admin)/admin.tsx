import { Stack } from 'expo-router';

import { RoleHome } from '@/features/auth/role-home';

export default function AdminHomeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Dashboard' }} />
      <RoleHome heading="Business dashboard" />
    </>
  );
}
