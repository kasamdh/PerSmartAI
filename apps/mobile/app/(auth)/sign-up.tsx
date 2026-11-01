import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { signUpBusiness } from '@/features/auth/api';
import { businessSignUpSchema, type BusinessSignUpValues } from '@/features/auth/schemas';
import { deviceTimeZone } from '@/lib/time-zone';
import { zodResolver } from '@/lib/zod-resolver';
import { SignUpConsent } from '@/features/legal/legal-links';

/** Starts a new pet-sitting business; the signer-up becomes its admin. */
export default function SignUpScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<BusinessSignUpValues>({
    resolver: zodResolver(businessSignUpSchema),
    defaultValues: {
      businessName: '',
      timeZone: deviceTimeZone(),
      fullName: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { needsEmailConfirmation } = await signUpBusiness(values);
      if (needsEmailConfirmation) setConfirmEmailFor(values.email);
      // Otherwise the new session routes straight to the admin dashboard.
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  });

  if (confirmEmailFor) {
    return (
      <FormScreen
        title="Confirm your email"
        subtitle={`We sent a link to ${confirmEmailFor}. Open it on this phone to finish setting up your business.`}
      >
        <Text style={styles.note}>You can close this screen; the link will bring you back.</Text>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Start your business"
      subtitle="You'll be the admin. You can invite sitters and pet owners next."
      error={formError}
    >
      <FormField
        control={control}
        name="businessName"
        label="Business name"
        placeholder="e.g. Happy Paws Pet Care"
        autoCapitalize="words"
      />
      <FormField
        control={control}
        name="timeZone"
        label="Time zone"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityHint="Visit times are shown in this time zone"
      />
      <FormField
        control={control}
        name="fullName"
        label="Your name"
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
      />
      <FormField
        control={control}
        name="email"
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <FormField
        control={control}
        name="password"
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => onSubmit()}
      />
      <BigButton label="Create business" onPress={() => onSubmit()} loading={isSubmitting} />
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
});
