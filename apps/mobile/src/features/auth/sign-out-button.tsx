import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Icon, ListItem, PressableScale } from '@/components/ui';
import { useBrand } from '@/features/branding/brand-context';
import { useTheme } from '@/theme';

import { signOut } from './api';

/** Asks first, so a one-handed tap can't sign someone out by accident. */
export function confirmSignOut(onConfirm: () => void) {
  Alert.alert('Sign out?', 'You can sign back in any time with your email and password.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Sign out, for every role. `button` (default) for screen footers and Profile;
 * `row` inside a list card. Signing out also removes this phone's push token.
 */
export function SignOutButton({ variant = 'button' }: { variant?: 'button' | 'row' }) {
  const [signingOut, setSigningOut] = useState(false);

  const run = () =>
    confirmSignOut(async () => {
      setSigningOut(true);
      try {
        await signOut();
      } finally {
        setSigningOut(false);
      }
    });

  if (variant === 'row') {
    return (
      <ListItem
        title={signingOut ? 'Signing out…' : 'Sign out'}
        leading={<Icon name="logout" color="danger" />}
        onPress={run}
        accessibilityHint="Asks before signing you out"
      />
    );
  }
  return (
    <Button
      label="Sign out"
      variant="secondary"
      icon="logout"
      loading={signingOut}
      onPress={run}
      accessibilityHint="Asks before signing you out"
    />
  );
}

/**
 * Sign out from a screen's top bar (white-label header): a 48 pt icon with a
 * label for screen readers, and the same confirmation.
 */
export function SignOutHeaderButton() {
  const theme = useTheme();
  const { colors } = useBrand();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      accessibilityHint="Asks before signing you out"
      hitSlop={4}
      onPress={() => confirmSignOut(() => void signOut())}
      style={{
        width: theme.size.tap,
        height: theme.size.tap,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LogOut size={theme.size.icon.md} color={colors.onPrimary} strokeWidth={2.2} />
    </PressableScale>
  );
}
