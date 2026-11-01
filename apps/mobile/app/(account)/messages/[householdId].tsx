import { Stack, useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '@/features/chat/chat-screen';
import { useConversations } from '@/features/chat/hooks';

export default function ChatRoute() {
  const { householdId } = useLocalSearchParams<{ householdId: string }>();
  const name = useConversations().data?.find((c) => c.household_id === householdId)?.household_name;
  return (
    <>
      <Stack.Screen options={{ title: name ?? 'Messages' }} />
      <ChatScreen householdId={householdId} />
    </>
  );
}
