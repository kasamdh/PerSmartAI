import { Stack } from 'expo-router';

import { RoleHome } from '@/features/auth/role-home';

export default function SitterHomeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Today' }} />
      <RoleHome heading="Your schedule" />
    </>
  );
}
