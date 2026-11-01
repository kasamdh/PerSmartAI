import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { sendSignInCode, verifySignInCode } from '@/features/auth/api';
import {
  emailOnlySchema,
  otpCodeSchema,
  type EmailOnlyValues,
  type OtpCodeValues,
} from '@/features/auth/schemas';
import { zodResolver } from '@/lib/zod-resolver';

/** Passwordless sign-in: emails a magic link and a 6-digit code (either works). */
export default function MagicLinkScreen() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const emailForm = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });
  const codeForm = useForm<OtpCodeValues>({
    resolver: zodResolver(otpCodeSchema),
    defaultValues: { code: '' },
  });

  const send = emailForm.handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await sendSignInCode(email);
      setSentTo(email);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  });

  const verify = codeForm.handleSubmit(async ({ code }) => {
    if (!sentTo) return;
    setFormError(null);
    try {
      await verifySignInCode(sentTo, code);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  });

  if (!sentTo) {
    return (
      <FormScreen
        title="Sign in by email"
        subtitle="We'll email you a sign-in link and a 6-digit code."
        error={formError}
      >
        <FormField
          control={emailForm.control}
          name="email"
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={() => send()}
        />
        <BigButton
          label="Email me a code"
          onPress={() => send()}
          loading={emailForm.formState.isSubmitting}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Check your email"
      subtitle={`If ${sentTo} has an account, we sent a code. Tap the link in the email, or type the code here.`}
      error={formError}
      footer={
        <>
          <TextButton label="Send a new code" onPress={() => send()} />
          <TextButton label="Use a different email" onPress={() => setSentTo(null)} />
        </>
      }
    >
      <FormField
        control={codeForm.control}
        name="code"
        label="6-digit code"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={() => verify()}
      />
      <BigButton
        label="Sign in"
        onPress={() => verify()}
        loading={codeForm.formState.isSubmitting}
      />
    </FormScreen>
  );
}
