import { Stack } from 'expo-router';

import { AdminHomeScreen } from '@/features/admin/admin-home-screen';

export default function AdminHome() {
  return (
    <>
      <Stack.Screen options={{ title: 'Dashboard' }} />
      <AdminHomeScreen />
    </>
  );
}
