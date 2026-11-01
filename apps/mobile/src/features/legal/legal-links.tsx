import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TAP_TARGET } from '@/components/big-button';

// The privacy policy and terms are web pages on the admin site (the stores need
// public URLs). EXPO_PUBLIC_LEGAL_URL is that site's address, set per environment.
const BASE = process.env.EXPO_PUBLIC_LEGAL_URL?.replace(/\/+$/, '');

export const LEGAL_PAGES = {
  privacy: { path: '/privacy', label: 'Privacy policy' },
  terms: { path: '/terms', label: 'Terms of service' },
} as const;

export function legalUrl(page: keyof typeof LEGAL_PAGES, base = BASE): string | null {
  return base ? `${base}${LEGAL_PAGES[page].path}` : null;
}

function LegalLink({ page }: { page: keyof typeof LEGAL_PAGES }) {
  const url = legalUrl(page);
  if (!url) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${LEGAL_PAGES[page].label} (opens in browser)`}
      onPress={() => void WebBrowser.openBrowserAsync(url)}
      hitSlop={8}
      style={styles.link}
    >
      <Text style={styles.linkText}>{LEGAL_PAGES[page].label}</Text>
    </Pressable>
  );
}

/** Links to the privacy policy and terms (profile screen). */
export function LegalLinks() {
  if (!BASE) return null;
  return (
    <View style={styles.row}>
      <LegalLink page="privacy" />
      <LegalLink page="terms" />
    </View>
  );
}

/** "By creating an account you agree to…" under sign-up buttons. */
export function SignUpConsent() {
  if (!BASE) return null;
  return (
    <View style={styles.consent}>
      <Text style={styles.consentText}>By creating an account you agree to the</Text>
      <View style={styles.row}>
        <LegalLink page="terms" />
        <LegalLink page="privacy" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  link: { minHeight: MIN_TAP_TARGET, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { fontSize: 16, color: '#1565C0', textDecorationLine: 'underline' },
  consent: { alignItems: 'center', gap: 2 },
  consentText: { fontSize: 15, color: '#555555', textAlign: 'center' },
});
