import { Stack } from 'expo-router';

import { LoadingView } from '@/components/query-states';
import { useProfile } from '@/features/auth/use-profile';
import { NotificationSettingsScreen } from '@/features/notifications/notification-settings-screen';

export default function NotificationSettingsRoute() {
  const role = useProfile().data?.role;
  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      {role ? <NotificationSettingsScreen role={role} /> : <LoadingView />}
    </>
  );
}
