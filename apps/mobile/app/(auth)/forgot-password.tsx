import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { sendPasswordReset, verifyRecoveryCode } from '@/features/auth/api';
import {
  emailOnlySchema,
  otpCodeSchema,
  type EmailOnlyValues,
  type OtpCodeValues,
} from '@/features/auth/schemas';
import { zodResolver } from '@/lib/zod-resolver';

/**
 * Step 1 emails a reset link + code; step 2 verifies the code, which signs the user
 * in in recovery mode, and routing then shows the "Set a new password" screen.
 */
export default function ForgotPasswordScreen() {
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
      await sendPasswordReset(email);
      setSentTo(email);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  });

  const verify = codeForm.handleSubmit(async ({ code }) => {
    if (!sentTo) return;
    setFormError(null);
    try {
      await verifyRecoveryCode(sentTo, code);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  });

  if (!sentTo) {
    return (
      <FormScreen
        title="Forgot password"
        subtitle="Enter your email and we'll send you a code to reset it."
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
          label="Send reset code"
          onPress={() => send()}
          loading={emailForm.formState.isSubmitting}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Enter the code"
      subtitle={`If ${sentTo} has an account, we sent a 6-digit code. You can also tap the link in the email.`}
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
        label="Continue"
        onPress={() => verify()}
        loading={codeForm.formState.isSubmitting}
      />
    </FormScreen>
  );
}
