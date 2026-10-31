import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.hero}>
        <Text style={styles.title} accessibilityRole="header">
          Pet Sitter App
        </Text>
        <Text style={styles.subtitle}>Dogs and cats, cared for.</Text>
      </View>

      {/* Temporary role shortcuts until auth routes users by role. */}
      <View style={styles.actions}>
        <Link href="/owner" asChild>
          <BigButton label="I'm an owner" />
        </Link>
        <Link href="/sitter" asChild>
          <BigButton label="I'm a sitter" />
        </Link>
        <Link href="/admin" asChild>
          <BigButton label="I run a business" />
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#555555',
  },
  // Actions sit low on the screen so they are reachable with one thumb.
  actions: {
    gap: 12,
    paddingBottom: 24,
  },
});
