import { Stack } from 'expo-router';

import { useBrandedHeader } from '@/features/branding/brand';

export default function AccountLayout() {
  return <Stack screenOptions={useBrandedHeader()} />;
}
