import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { supabase } from '@/lib/supabase';

import { SignOutButton } from './sign-out-button';

// Admins sign in with a password plus a code from an authenticator app. The
// database grants admin access only to two-step sessions, so this screen is the
// only one an admin sees until it's done. First time: add the key to an
// authenticator app; after that: enter a code.

type State =
  | { kind: 'loading' }
  | { kind: 'verify'; factorId: string }
  | { kind: 'enroll'; factorId: string; uri: string; secret: string }
  | { kind: 'error'; message: string };

export function TwoStepScreen() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setState({ kind: 'error', message: listError.message });
      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) {
        if (!cancelled) setState({ kind: 'verify', factorId: verified.id });
        return;
      }
      // Drop half-finished setups, then start a new one.
      for (const f of data.all.filter((f) => f.status === 'unverified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator app',
      });
      if (enrollError) return setState({ kind: 'error', message: enrollError.message });
      if (!cancelled) {
        setState({
          kind: 'enroll',
          factorId: enrolled.id,
          uri: enrolled.totp.uri,
          secret: enrolled.totp.secret,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const verify = async () => {
    if (state.kind !== 'verify' && state.kind !== 'enroll') return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setPending(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: state.factorId,
      code: digits,
    });
    setPending(false);
    if (verifyError) {
      setError(
        verifyError.status === 429
          ? 'Too many tries. Wait a minute and try again.'
          : 'That code didn’t work. Check the time on your phone and try the newest code.',
      );
    }
    // On success the session becomes two-step and routing opens the admin screens.
  };

  const openAuthenticator = async (uri: string) => {
    const canOpen = await Linking.canOpenURL(uri).catch(() => false);
    if (canOpen) await Linking.openURL(uri);
    else setError('No authenticator app found. Install one, or type the key below into it.');
  };

  return (
    <FormScreen
      title="Two-step sign-in"
      subtitle={
        state.kind === 'enroll'
          ? 'Admins protect their clients’ details with a code from an authenticator app (such as Google Authenticator or Microsoft Authenticator). Set it up once.'
          : 'Enter the 6-digit code from your authenticator app.'
      }
      error={state.kind === 'error' ? state.message : error}
    >
      {state.kind === 'enroll' ? (
        <View style={styles.setup}>
          <BigButton
            label="Open my authenticator app"
            onPress={() => void openAuthenticator(state.uri)}
          />
          <Text style={styles.help}>Or type this key into the app:</Text>
          <Text selectable style={styles.secret} accessibilityLabel={`Key: ${state.secret}`}>
            {state.secret}
          </Text>
          <Text style={styles.help}>Then enter the code it shows:</Text>
        </View>
      ) : null}
      {state.kind === 'verify' || state.kind === 'enroll' ? (
        <>
          <TextField
            label="6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={7}
            onSubmitEditing={() => void verify()}
          />
          <BigButton
            label={state.kind === 'enroll' ? 'Turn on and continue' : 'Continue'}
            onPress={() => void verify()}
            loading={pending}
          />
        </>
      ) : null}
      <SignOutButton />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  setup: { gap: 10 },
  help: { fontSize: 17, color: '#333333' },
  secret: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#111111',
    backgroundColor: '#F2F4F7',
    padding: 12,
    borderRadius: 10,
  },
});
