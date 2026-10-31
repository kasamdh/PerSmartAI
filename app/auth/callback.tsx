import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { FormScreen } from '@/components/form-screen';
import { exchangeAuthCode } from '@/features/auth/api';

/**
 * Email links (magic link, password reset, sign-up confirmation) open
 * petsitter://auth/callback?code=... Exchange the code for a session, then let
 * the entry route decide where to go (recovery links trigger the reset screen).
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { code, error_description: linkError } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [status, setStatus] = useState<'working' | 'done' | string>(
    linkError ? linkError : code ? 'working' : 'This link is missing its sign-in code.',
  );

  useEffect(() => {
    if (!code || linkError) return;
    exchangeAuthCode(code)
      .then(() => setStatus('done'))
      .catch((error: Error) => setStatus(error.message));
  }, [code, linkError]);

  if (status === 'done') return <Redirect href="/" />;

  if (status === 'working') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Signing you in" />
      </View>
    );
  }

  return (
    <FormScreen title="That link didn't work" subtitle={status}>
      <BigButton label="Back to start" onPress={() => router.replace('/')} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
