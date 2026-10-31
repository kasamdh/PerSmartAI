import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { PhotoPicker } from '@/components/photo-picker';
import { ErrorView, LoadingView } from '@/components/query-states';
import { useProfile } from '@/features/auth/use-profile';
import type { CompressedImage } from '@/lib/images';
import { zodResolver } from '@/lib/zod-resolver';

import { useDeletePet, useOwnHousehold, usePet, usePetPhotoUrl, useSavePet } from './hooks';
import { petRouteFor } from './routes';
import { EMPTY_PET, fromPetRow, petSchema, type PetFormValues } from './schemas';

const SPECIES = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
] as const;
const SEX = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'unknown', label: 'Not sure' },
] as const;
const FIXED = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Not sure' },
] as const;

/** Add a pet (no petId) or edit one. Owners only. */
export function PetFormScreen({ petId }: { petId?: string }) {
  const router = useRouter();
  const { data: profile } = useProfile();
  const household = useOwnHousehold();
  const existing = usePet(petId ?? '');
  const photoUrl = usePetPhotoUrl(existing.data?.photo_url);
  const save = useSavePet();
  const remove = useDeletePet();
  const [photo, setPhoto] = useState<CompressedImage | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<PetFormValues>({
    resolver: zodResolver(petSchema),
    values: petId && existing.data ? fromPetRow(existing.data) : EMPTY_PET,
  });

  if (household.isPending || (petId && existing.isPending)) return <LoadingView />;
  if (household.isError || (petId && existing.isError)) {
    return (
      <ErrorView
        onRetry={() => {
          void household.refetch();
          void existing.refetch();
        }}
      />
    );
  }
  if (!household.data || !profile) {
    return (
      <ErrorView title="Add your home address first" onRetry={() => router.replace('/household')} />
    );
  }

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    save.mutate(
      {
        petId,
        householdId: household.data!.id,
        organizationId: profile.organization_id,
        values,
        photo,
        previousPhotoPath: existing.data?.photo_url ?? null,
      },
      {
        onSuccess: (id) => (petId ? router.back() : router.replace(petRouteFor('owner', id))),
        onError: () => setFormError("Couldn't save. Check your connection and try again."),
      },
    );
  });

  const confirmDelete = () =>
    existing.data &&
    Alert.alert(
      `Remove ${existing.data.name}?`,
      'Their profile, bookings, and visit history will be deleted. This can’t be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            remove.mutate(existing.data!, {
              onSuccess: () => router.replace('/owner'),
              onError: () => Alert.alert("Couldn't remove the pet", 'Please try again.'),
            }),
        },
      ],
    );

  return (
    <FormScreen
      title={petId ? `Edit ${existing.data?.name ?? 'pet'}` : 'Add a pet'}
      error={formError}
    >
      <PhotoPicker currentUrl={photoUrl.data} onPicked={setPhoto} maxWidth={1080} />

      <FormField control={control} name="name" label="Name" autoCapitalize="words" />
      <Controller
        control={control}
        name="species"
        render={({ field, fieldState }) => (
          <ChoiceChips
            label="Species"
            options={SPECIES}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <FormField control={control} name="breed" label="Breed (optional)" autoCapitalize="words" />
      <FormField
        control={control}
        name="birthDate"
        label="Birth date (optional)"
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
      />
      <FormField
        control={control}
        name="weightLb"
        label="Weight in lb (optional)"
        keyboardType="decimal-pad"
      />
      <Controller
        control={control}
        name="sex"
        render={({ field }) => (
          <ChoiceChips label="Sex" options={SEX} value={field.value} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="spayedNeutered"
        render={({ field }) => (
          <ChoiceChips
            label="Spayed / neutered"
            options={FIXED}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <FormField
        control={control}
        name="microchip"
        label="Microchip number (optional)"
        autoCapitalize="characters"
      />

      <Text style={styles.heading}>Temperament</Text>
      <FormField
        control={control}
        name="temperamentNotes"
        label="Personality and handling notes"
        placeholder="e.g. Friendly but pulls on the leash near squirrels"
        multiline
        style={styles.multiline}
      />

      <Text style={styles.heading}>Vet</Text>
      <FormField
        control={control}
        name="vetName"
        label="Vet or clinic name"
        autoCapitalize="words"
      />
      <FormField control={control} name="vetPhone" label="Vet phone" keyboardType="phone-pad" />
      <FormField control={control} name="vetAddress" label="Vet address" />

      <BigButton
        label={petId ? 'Save changes' : 'Add pet'}
        onPress={() => onSubmit()}
        loading={save.isPending}
      />
      {petId ? (
        <View style={styles.danger}>
          <BigButton
            label="Remove pet"
            variant="secondary"
            onPress={confirmDelete}
            loading={remove.isPending}
          />
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginTop: 8 },
  multiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  danger: { marginTop: 16 },
});
