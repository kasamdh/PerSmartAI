import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import type { AppRole } from '@/types/models';

import { registerForPushNotifications } from './push';
import { pushRouteFor } from './push-routes';

// Show notifications as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for pushes once the user's role is known, and opens the
 * visit or booking when a notification is tapped (including the one that launched the app).
 */
export function usePushNotifications(role: AppRole | undefined) {
  const router = useRouter();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!role) return;
    registerForPushNotifications().catch((error: unknown) => {
      if (__DEV__) console.warn('[push] registration failed', error);
    });
  }, [role]);

  useEffect(() => {
    const data = lastResponse?.notification.request.content.data;
    const route = role ? pushRouteFor(role, data) : null;
    if (route) {
      router.push(route);
    }
  }, [lastResponse, role, router]);
}
