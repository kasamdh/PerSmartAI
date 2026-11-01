import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { BrandProvider } from '@/features/branding/brand';
import { routeGuards } from '@/features/auth/routing';
import { useRoutingState } from '@/features/auth/use-routing-state';
import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { setAnalyticsRole } from '@/lib/analytics';
import { initMonitoring, setMonitoringUser, wrapRoot } from '@/lib/monitoring';
import { queryClient } from '@/lib/query-client';
import type { AppRole } from '@/types/models';

initMonitoring();
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrandProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </BrandProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default wrapRoot(RootLayout);

// Route groups only exist while their guard is true (see routeGuards). When one
// flips (sign in/out, onboarding done, password reset) Expo Router falls back to
// `index`, which redirects via resolveDestination.
function RootNavigator() {
  const { isRestoring, session } = useAuth();
  const routing = useRoutingState();
  const guards = routeGuards(routing);
  usePushNotifications(guards.account ? (routing.role as AppRole) : undefined);

  const userId = session?.user.id;
  useEffect(() => {
    setMonitoringUser(userId && routing.role ? { id: userId, role: routing.role } : null);
    setAnalyticsRole(userId ? (routing.role ?? null) : null);
  }, [userId, routing.role]);

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
      {/* Email links land here from any state. */}
      <Stack.Screen name="auth/callback" />
      <Stack.Protected guard={guards.auth}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={guards.resetPassword}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={guards.ownerOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={guards.owner}>
        <Stack.Screen name="(owner)" />
      </Stack.Protected>
      <Stack.Protected guard={guards.sitter}>
        <Stack.Screen name="(sitter)" />
      </Stack.Protected>
      <Stack.Protected guard={guards.admin}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
      <Stack.Protected guard={guards.account}>
        <Stack.Screen name="(account)" />
      </Stack.Protected>
    </Stack>
  );
}
