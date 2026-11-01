import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { useForm } from 'react-hook-form';
import type { TextInput } from 'react-native';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { signIn } from '@/features/auth/api';
import { signInSchema, type SignInValues } from '@/features/auth/schemas';
import { zodResolver } from '@/lib/zod-resolver';
import { useCaptcha } from '@/features/auth/captcha';

export default function SignInScreen() {
  const router = useRouter();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Security check for this form (Turnstile; single-use token).
  const captcha = useCaptcha();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  // On success the auth listener updates the session and routing takes over.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!captcha.ready) {
      setFormError('Please wait a moment for the security check, then try again.');
      return;
    }
    try {
      await signIn(values, captcha.token);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      captcha.reset();
    }
  });

  return (
    <FormScreen
      title="Log in"
      subtitle="Welcome back"
      error={formError}
      footer={
        <>
          <TextButton
            label="Email me a sign-in code instead"
            onPress={() => router.push('/magic-link')}
          />
          <TextButton label="Forgot password?" onPress={() => router.push('/forgot-password')} />
        </>
      }
    >
      <FormField
        control={control}
        name="email"
        label="Email"
        testID="sign-in-email"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <FormField
        control={control}
        name="password"
        ref={passwordRef}
        label="Password"
        testID="sign-in-password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => onSubmit()}
      />
      {captcha.view}
      <BigButton label="Log in" onPress={() => onSubmit()} loading={isSubmitting} />
    </FormScreen>
  );
}
