import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-provider';
import { homeRouteForRole } from '@/features/auth/routes';
import { useProfile } from '@/features/auth/use-profile';

/** Entry point: sends each user to sign-in or their role's home. */
export default function Index() {
  const { session } = useAuth();
  const profile = useProfile();

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  if (profile.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Loading your account" />
      </View>
    );
  }

  if (profile.data) {
    return <Redirect href={homeRouteForRole(profile.data.role)} />;
  }

  // Signed in, but no profile (not yet added to a business) or it failed to load.
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <Text style={styles.title} accessibilityRole="header">
          {profile.isError ? "Couldn't load your account" : 'Account not set up yet'}
        </Text>
        <Text style={styles.body}>
          {profile.isError
            ? 'Check your connection and try again.'
            : 'Ask your pet-sitting business to add you, then sign in again.'}
        </Text>
      </View>
      <View style={styles.actions}>
        {profile.isError ? <BigButton label="Try again" onPress={() => profile.refetch()} /> : null}
        <BigButton label="Sign out" variant="secondary" onPress={() => signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  body: {
    fontSize: 18,
    color: '#555555',
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
});
