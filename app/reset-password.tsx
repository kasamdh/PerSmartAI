import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { signOut, updatePassword } from '@/features/auth/api';
import { newPasswordSchema, type NewPasswordValues } from '@/features/auth/schemas';
import { zodResolver } from '@/lib/zod-resolver';

/** Shown only in password-recovery mode; saving ends recovery and routes home. */
export default function ResetPasswordScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await updatePassword(password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  });

  return (
    <FormScreen
      title="Set a new password"
      error={formError}
      footer={<TextButton label="Cancel and sign out" onPress={() => void signOut()} />}
    >
      <FormField
        control={control}
        name="password"
        label="New password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormField
        control={control}
        name="confirm"
        label="Repeat new password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => onSubmit()}
      />
      <BigButton label="Save password" onPress={() => onSubmit()} loading={isSubmitting} />
    </FormScreen>
  );
}
