import { useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { signOut } from '@/features/auth/api';
import { resolveDestination } from '@/features/auth/routing';
import { useRoutingState } from '@/features/auth/use-routing-state';

/** Entry point: sends each user to welcome, onboarding, or their role's home. */
export default function Index() {
  const queryClient = useQueryClient();
  const destination = resolveDestination(useRoutingState());

  if (destination.kind === 'redirect') {
    return <Redirect href={destination.href} />;
  }

  if (destination.kind === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Loading your account" />
      </View>
    );
  }

  const failed = destination.kind === 'error';
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <Text style={styles.title} accessibilityRole="header">
          {failed ? "Couldn't load your account" : 'Account not set up yet'}
        </Text>
        <Text style={styles.body}>
          {failed
            ? 'Check your connection and try again.'
            : 'Ask your pet-sitting business for an invite code, then sign up with it.'}
        </Text>
      </View>
      <View style={styles.actions}>
        {failed ? (
          <BigButton label="Try again" onPress={() => queryClient.invalidateQueries()} />
        ) : null}
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
