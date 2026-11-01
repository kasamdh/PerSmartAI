import { Stack } from 'expo-router';

import { InvitesScreen } from '@/features/admin/invites-screen';

export default function InvitesRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Invite people', headerBackTitle: 'Dashboard' }} />
      <InvitesScreen />
    </>
  );
}
