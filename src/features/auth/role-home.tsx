import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignOutButton } from './sign-out-button';
import { useProfile } from './use-profile';

/** Temporary home for each role until the real role screens are built. */
export function RoleHome({ heading }: { heading: string }) {
  const { data: profile } = useProfile();
  const firstName = profile?.full_name.split(' ')[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <View style={styles.hero}>
        <Text style={styles.greeting} accessibilityRole="header">
          {firstName ? `Hi, ${firstName}` : 'Welcome'}
        </Text>
        <Text style={styles.heading}>{heading}: coming soon</Text>
      </View>
      <SignOutButton />
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
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  heading: {
    fontSize: 20,
    color: '#555555',
    textAlign: 'center',
  },
});
