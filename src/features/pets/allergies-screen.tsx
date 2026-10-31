import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { ErrorView, LoadingView } from '@/components/query-states';
import { zodResolver } from '@/lib/zod-resolver';

import { AllergyBanner } from './allergy-banner';
import { useDeleteAllergy, usePet, useSaveAllergy } from './hooks';
import { EditableRow, EditorCard } from './list-editor';
import { allergySchema, type AllergyFormValues } from './schemas';

const SEVERITIES = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
] as const;

const EMPTY: AllergyFormValues = { allergen: '', severity: 'moderate', reactionNotes: '' };

export function AllergiesScreen({ petId }: { petId: string }) {
  const pet = usePet(petId);
  const save = useSaveAllergy(petId);
  const remove = useDeleteAllergy();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<AllergyFormValues>({
    resolver: zodResolver(allergySchema),
    defaultValues: EMPTY,
  });

  if (pet.isPending) return <LoadingView />;
  if (pet.isError || !pet.data) return <ErrorView onRetry={() => void pet.refetch()} />;
  const allergies = pet.data.pet_allergies;

  const startEdit = (a: (typeof allergies)[number]) => {
    setEditingId(a.id);
    reset({ allergen: a.allergen, severity: a.severity, reactionNotes: a.reaction_notes ?? '' });
  };
  const cancel = () => {
    setEditingId(null);
    reset(EMPTY);
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    save.mutate(
      { values, id: editingId ?? undefined },
      {
        onSuccess: cancel,
        onError: () => setFormError("Couldn't save. Check your connection and try again."),
      },
    );
  });

  const confirmRemove = (a: (typeof allergies)[number]) =>
    Alert.alert(`Remove ${a.allergen}?`, undefined, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(a.id) },
    ]);

  return (
    <FormScreen title={`${pet.data.name}’s allergies`} error={formError}>
      <AllergyBanner allergies={allergies} />
      <EditorCard title={allergies.length ? 'Allergies' : 'No allergies recorded'}>
        {allergies.map((a) => (
          <EditableRow
            key={a.id}
            title={a.allergen}
            subtitle={[a.severity, a.reaction_notes].filter(Boolean).join(' · ')}
            emphasized={a.severity === 'severe'}
            onEdit={() => startEdit(a)}
            onRemove={() => confirmRemove(a)}
          />
        ))}
      </EditorCard>

      <EditorCard title={editingId ? 'Edit allergy' : 'Add an allergy'}>
        <FormField
          control={control}
          name="allergen"
          label="Allergic to"
          placeholder="e.g. Chicken, bee stings"
        />
        <Controller
          control={control}
          name="severity"
          render={({ field, fieldState }) => (
            <ChoiceChips
              label="Severity"
              options={SEVERITIES}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <FormField
          control={control}
          name="reactionNotes"
          label="Reaction and what to do (optional)"
          placeholder="e.g. Face swells. Call the vet; Benadryl in kitchen drawer."
          multiline
        />
        <BigButton
          label={editingId ? 'Save allergy' : 'Add allergy'}
          onPress={() => onSubmit()}
          loading={save.isPending}
        />
        {editingId ? <TextButton label="Cancel editing" onPress={cancel} /> : null}
      </EditorCard>
    </FormScreen>
  );
}
