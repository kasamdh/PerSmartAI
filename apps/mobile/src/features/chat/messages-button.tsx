import { useRouter } from 'expo-router';

import { BigButton } from '@/components/big-button';

import { useUnreadCount } from './hooks';

/** "Messages (3 new)" on the owner and admin home screens (sitters have a tab). */
export function MessagesButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const router = useRouter();
  const unread = useUnreadCount().data ?? 0;
  return (
    <BigButton
      label={unread > 0 ? `Messages (${unread > 99 ? '99+' : unread} new)` : 'Messages'}
      variant={unread > 0 ? 'primary' : variant}
      onPress={() => router.push('/messages')}
    />
  );
}
