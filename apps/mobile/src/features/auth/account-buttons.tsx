import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { BigButton } from '@/components/big-button';

import { SignOutButton } from './sign-out-button';

/** Footer on each role's home: profile (incl. delete account), notifications, sign out. */
export function AccountButtons() {
  const router = useRouter();
  return (
    <View style={{ gap: 10 }}>
      <BigButton label="My profile" variant="secondary" onPress={() => router.push('/profile')} />
      <BigButton
        label="Notifications"
        variant="secondary"
        onPress={() => router.push('/notifications')}
      />
      <SignOutButton />
    </View>
  );
}
