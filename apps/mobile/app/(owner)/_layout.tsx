import { Stack } from 'expo-router';

import { useBrandedHeader } from '@/features/branding/brand';

export default function Layout() {
  return <Stack screenOptions={useBrandedHeader()} />;
}
