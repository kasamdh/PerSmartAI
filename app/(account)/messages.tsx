import { Stack } from 'expo-router';

import { ConversationListScreen } from '@/features/chat/conversation-list-screen';

export default function MessagesRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Messages' }} />
      <ConversationListScreen />
    </>
  );
}
