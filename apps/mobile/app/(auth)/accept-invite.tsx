import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { checkInvite, signUpWithInvite, type InvitePreview } from '@/features/auth/api';
import { inviteLookupErrorMessage } from '@/features/auth/errors';
import { formatInviteCode, normalizeInviteCode } from '@/features/auth/invite-code';
import {
  inviteCodeSchema,
  inviteSignUpSchema,
  type InviteCodeValues,
  type InviteSignUpValues,
} from '@/features/auth/schemas';
import { zodResolver } from '@/lib/zod-resolver';
import { SignUpConsent } from '@/features/legal/legal-links';
import { useCaptcha } from '@/features/auth/captcha';

const ROLE_TEXT = { owner: 'a pet owner', sitter: 'a sitter', admin: 'an admin' } as const;

/** Join a business with an invite code (typed, or from an invite link ?code=...). */
export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [invite, setInvite] = useState<{ code: string; preview: InvitePreview } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Security check for this form (Turnstile; single-use token).
  const captcha = useCaptcha();
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null);

  const codeForm = useForm<InviteCodeValues>({
    resolver: zodResolver(inviteCodeSchema),
    defaultValues: { code: params.code ? formatInviteCode(params.code) : '' },
  });
  const signUpForm = useForm<InviteSignUpValues>({
    resolver: zodResolver(inviteSignUpSchema),
    defaultValues: { fullName: '', phone: '', email: '', password: '' },
  });

  const lookUp = codeForm.handleSubmit(async ({ code }) => {
    setFormError(null);
    try {
      const preview = await checkInvite(code);
      if (!preview) {
        setFormError('That code is not valid. It may have expired or already been used.');
        return;
      }
      setInvite({ code: normalizeInviteCode(code), preview });
    } catch (error) {
      setFormError(inviteLookupErrorMessage(error as { code?: string; status?: number }));
    }
  });

  const join = signUpForm.handleSubmit(async (values) => {
    if (!invite) return;
    setFormError(null);
    if (!captcha.ready) {
      setFormError('Please wait a moment for the security check, then try again.');
      return;
    }
    try {
      const { needsEmailConfirmation } = await signUpWithInvite(invite.code, values, captcha.token);
      if (needsEmailConfirmation) setConfirmEmailFor(values.email);
      // Otherwise routing takes over (owners go on to add their household).
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      captcha.reset();
    }
  });

  if (confirmEmailFor) {
    return (
      <FormScreen
        title="Confirm your email"
        subtitle={`We sent a link to ${confirmEmailFor}. Open it on this phone to finish joining.`}
      >
        <Text style={styles.note}>You can close this screen; the link will bring you back.</Text>
      </FormScreen>
    );
  }

  if (!invite) {
    return (
      <FormScreen
        title="Join with an invite"
        subtitle="Enter the code your pet-sitting business sent you."
        error={formError}
      >
        <FormField
          control={codeForm.control}
          name="code"
          label="Invite code"
          placeholder="K7QM-3XPT"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => lookUp()}
        />
        <BigButton
          label="Continue"
          onPress={() => lookUp()}
          loading={codeForm.formState.isSubmitting}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={`Join ${invite.preview.organizationName}`}
      subtitle={`You're joining as ${ROLE_TEXT[invite.preview.role]}.`}
      error={formError}
      footer={<TextButton label="Use a different code" onPress={() => setInvite(null)} />}
    >
      {invite.preview.emailLocked ? (
        <View style={styles.info}>
          <Text style={styles.infoText}>Use the email address the invite was sent to.</Text>
        </View>
      ) : null}
      <FormField
        control={signUpForm.control}
        name="fullName"
        label="Your name"
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
      />
      <FormField
        control={signUpForm.control}
        name="phone"
        label="Phone (optional)"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <FormField
        control={signUpForm.control}
        name="email"
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <FormField
        control={signUpForm.control}
        name="password"
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => join()}
      />
      {captcha.view}
      <BigButton
        label="Create account"
        onPress={() => join()}
        loading={signUpForm.formState.isSubmitting}
      />
      <SignUpConsent />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 17,
    color: '#555555',
    textAlign: 'center',
  },
  info: {
    backgroundColor: '#E3F0FD',
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    fontSize: 16,
    color: '#0B5CAD',
  },
});
