import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { createHousehold, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-provider';
import { householdSchema, type HouseholdValues } from '@/features/auth/schemas';
import { ownerHouseholdKey } from '@/features/auth/use-routing-state';
import { useProfile } from '@/features/auth/use-profile';
import { zodResolver } from '@/lib/zod-resolver';

/** Owners finish joining by adding a phone number and their home address. */
export default function CompleteProfileScreen() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<HouseholdValues>({
    resolver: zodResolver(householdSchema),
    defaultValues: {
      phone: profile?.phone ?? '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      region: '',
      postalCode: '',
      entryInstructions: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!session || !profile) return;
    setFormError(null);
    try {
      await createHousehold(session.user.id, profile.full_name, values);
      // Routing sees the household and opens the owner home.
      await queryClient.invalidateQueries({ queryKey: ownerHouseholdKey(session.user.id) });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch {
      setFormError("Couldn't save your details. Check your connection and try again.");
    }
  });

  return (
    <FormScreen
      title="Your home"
      subtitle="Your sitter needs this to visit your pets."
      error={formError}
      footer={<TextButton label="Sign out" onPress={() => void signOut()} />}
    >
      <FormField
        control={control}
        name="phone"
        label="Your phone"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <FormField
        control={control}
        name="addressLine1"
        label="Street address"
        autoComplete="street-address"
        textContentType="streetAddressLine1"
      />
      <FormField
        control={control}
        name="addressLine2"
        label="Apartment, unit (optional)"
        textContentType="streetAddressLine2"
      />
      <FormField
        control={control}
        name="city"
        label="City"
        textContentType="addressCity"
        autoCapitalize="words"
      />
      <FormField
        control={control}
        name="region"
        label="State / region (optional)"
        textContentType="addressState"
      />
      <FormField
        control={control}
        name="postalCode"
        label="ZIP / postal code (optional)"
        textContentType="postalCode"
        autoComplete="postal-code"
      />
      <FormField
        control={control}
        name="entryInstructions"
        label="How do sitters get in? (optional)"
        placeholder="e.g. Lockbox on the back gate, code 1234"
        multiline
        accessibilityHint="Only shown to your sitter around visit times"
      />
      <BigButton label="Save and continue" onPress={() => onSubmit()} loading={isSubmitting} />
    </FormScreen>
  );
}
