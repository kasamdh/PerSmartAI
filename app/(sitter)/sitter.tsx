import { Stack } from 'expo-router';

import { SitterTodayScreen } from '@/features/visits/sitter-today-screen';

export default function SitterHomeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'My visits' }} />
      <SitterTodayScreen />
    </>
  );
}
