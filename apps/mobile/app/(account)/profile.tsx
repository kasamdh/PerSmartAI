import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { deleteAccount, updateProfile } from '@/features/auth/api';
import { DesignPreviewLink } from '@/features/design-preview/design-preview-link';
import { useAuth } from '@/features/auth/auth-provider';
import { profileSchema, type ProfileValues } from '@/features/auth/schemas';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { profileQueryKey, useProfile } from '@/features/auth/use-profile';
import { zodResolver } from '@/lib/zod-resolver';
import { LegalLinks } from '@/features/legal/legal-links';

const ROLE_LABELS = { owner: 'Pet owner', sitter: 'Sitter', admin: 'Admin' } as const;

const DELETE_WARNING = {
  owner:
    'Your account, your household, pets, bookings, visit history, and photos will be permanently deleted.',
  sitter:
    'Your account will be permanently deleted. Care logs you wrote stay with the business without your name.',
  admin:
    'Your account will be permanently deleted. If you are the only person in your business, the whole business is deleted too.',
} as const;

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting, isDirty },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { fullName: profile?.full_name ?? '', phone: profile?.phone ?? '' },
  });

  const onSave = handleSubmit(async (values) => {
    if (!session) return;
    setMessage(null);
    try {
      await updateProfile(session.user.id, values);
      await queryClient.invalidateQueries({ queryKey: profileQueryKey(session.user.id) });
      reset(values);
      setMessage('Saved.');
    } catch {
      setMessage("Couldn't save. Check your connection and try again.");
    }
  });

  const runDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount(); // signs out; routing returns to Welcome
    } catch (error) {
      setDeleting(false);
      Alert.alert("Couldn't delete your account", error instanceof Error ? error.message : '');
    }
  };

  const confirmDelete = () => {
    if (!profile) return;
    Alert.alert('Delete your account?', `${DELETE_WARNING[profile.role]} This can't be undone.`, [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => void runDelete() },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Profile' }} />
      <FormScreen
        title={profile?.full_name ?? 'Profile'}
        subtitle={[profile ? ROLE_LABELS[profile.role] : null, session?.user.email]
          .filter(Boolean)
          .join(' · ')}
        error={message && message !== 'Saved.' ? message : null}
      >
        <FormField control={control} name="fullName" label="Name" autoCapitalize="words" />
        <FormField
          control={control}
          name="phone"
          label="Phone"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        {message === 'Saved.' ? <Text style={styles.saved}>Saved.</Text> : null}
        <BigButton
          label="Save changes"
          onPress={() => onSave()}
          loading={isSubmitting}
          disabled={!isDirty}
        />

        <View style={styles.divider} />
        <SignOutButton />
        <DesignPreviewLink />
        <LegalLinks />

        <View style={styles.danger}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.dangerBody}>
            {profile ? DELETE_WARNING[profile.role] : 'Permanently delete your account.'}
          </Text>
          <BigButton
            label="Delete my account"
            variant="secondary"
            onPress={confirmDelete}
            loading={deleting}
            style={styles.deleteButton}
          />
        </View>
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  saved: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  divider: {
    height: 8,
  },
  danger: {
    marginTop: 24,
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3C7C3',
    backgroundColor: '#FFF7F6',
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B71C1C',
  },
  dangerBody: {
    fontSize: 15,
    color: '#5D4037',
  },
  deleteButton: {
    borderColor: '#C62828',
  },
});
