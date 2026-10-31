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

export default function SignInScreen() {
  const router = useRouter();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [formError, setFormError] = useState<string | null>(null);
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
    try {
      await signIn(values);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
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
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => onSubmit()}
      />
      <BigButton label="Log in" onPress={() => onSubmit()} loading={isSubmitting} />
    </FormScreen>
  );
}
