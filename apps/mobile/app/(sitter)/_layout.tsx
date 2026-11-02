import { Stack } from 'expo-router';

import { useBrandedHeader } from '@/features/branding/brand';
import { useStartUploadQueue } from '@/features/media/hooks';

export default function Layout() {
  // Uploads anything captured offline as soon as there's signal, on any screen.
  useStartUploadQueue();
  return (
    <Stack screenOptions={useBrandedHeader()}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
