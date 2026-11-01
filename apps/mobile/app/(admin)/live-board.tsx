import { Stack } from 'expo-router';

import { LiveBoardScreen } from '@/features/admin/live-board-screen';

export default function LiveBoardRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Live board' }} />
      <LiveBoardScreen />
    </>
  );
}
