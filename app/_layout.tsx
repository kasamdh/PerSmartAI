import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { useProfile } from '@/features/auth/use-profile';
import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Each role's route group is only mounted for that role. When a guard flips
// (sign in, sign out, role change) Expo Router redirects to `index`, which
// routes to the right place.
function RootNavigator() {
  const { session, isRestoring } = useAuth();
  const { data: profile } = useProfile();
  const role = session ? profile?.role : undefined;
  usePushNotifications(role);

  useEffect(() => {
    if (!isRestoring) {
      SplashScreen.hideAsync();
    }
  }, [isRestoring]);

  if (isRestoring) {
    return null; // splash screen stays visible
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'owner'}>
        <Stack.Screen name="(owner)" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'sitter'}>
        <Stack.Screen name="(sitter)" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
    </Stack>
  );
}
