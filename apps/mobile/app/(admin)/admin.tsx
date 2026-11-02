import { Stack } from 'expo-router';

import { AdminHomeScreen } from '@/features/admin/admin-home-screen';
import { SignOutHeaderButton } from '@/features/auth/sign-out-button';

export default function AdminHome() {
  return (
    <>
      <Stack.Screen options={{ title: 'Dashboard', headerRight: () => <SignOutHeaderButton /> }} />
      <AdminHomeScreen />
    </>
  );
}
