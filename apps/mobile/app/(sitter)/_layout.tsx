import { Stack } from 'expo-router';

import { useStartUploadQueue } from '@/features/media/hooks';

export default function Layout() {
  // Uploads anything captured offline as soon as there's signal, on any screen.
  useStartUploadQueue();
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
