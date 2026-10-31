import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { ErrorView, LoadingView } from '@/components/query-states';
import { zodResolver } from '@/lib/zod-resolver';

import { useDeleteMedication, usePet, useSaveMedication } from './hooks';
import { EditableRow, EditorCard } from './list-editor';
import { formatTimeOfDay, normalizeTimes } from './logic';
import { medicationSchema, type MedicationFormValues } from './schemas';
import { TimesField } from './times-field';

const EMPTY: MedicationFormValues = { name: '', dose: '', instructions: '', times: [] };

export function MedicationsScreen({ petId }: { petId: string }) {
  const pet = usePet(petId);
  const save = useSaveMedication(petId);
  const remove = useDeleteMedication();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationSchema),
    defaultValues: EMPTY,
  });

  if (pet.isPending) return <LoadingView />;
  if (pet.isError || !pet.data) return <ErrorView onRetry={() => void pet.refetch()} />;
  const meds = pet.data.pet_medications;

  const startEdit = (m: (typeof meds)[number]) => {
    setEditingId(m.id);
    reset({
      name: m.name,
      dose: m.dose ?? '',
      instructions: m.instructions ?? '',
      times: normalizeTimes(m.schedule_times),
    });
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

  return (
    <FormScreen title={`${pet.data.name}’s medications`} error={formError}>
      <EditorCard title={meds.length ? 'Medications' : 'No medications'}>
        {meds.map((m) => (
          <EditableRow
            key={m.id}
            title={[m.name, m.dose].filter(Boolean).join(' · ')}
            subtitle={
              m.schedule_times.length
                ? `At ${m.schedule_times.map(formatTimeOfDay).join(', ')}`
                : 'As needed'
            }
            onEdit={() => startEdit(m)}
            onRemove={() =>
              Alert.alert(`Remove ${m.name}?`, undefined, [
                { text: 'Keep', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(m.id) },
              ])
            }
          />
        ))}
      </EditorCard>

      <EditorCard title={editingId ? 'Edit medication' : 'Add a medication'}>
        <FormField control={control} name="name" label="Medication" placeholder="e.g. Apoquel" />
        <FormField
          control={control}
          name="dose"
          label="Dose (optional)"
          placeholder="e.g. 16 mg, 1 tablet"
        />
        <Controller
          control={control}
          name="times"
          render={({ field, fieldState }) => (
            <TimesField
              label="Times of day (leave empty if as needed)"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <FormField
          control={control}
          name="instructions"
          label="Instructions (optional)"
          placeholder="e.g. Hide in a treat; give with food"
          multiline
        />
        <BigButton
          label={editingId ? 'Save medication' : 'Add medication'}
          onPress={() => onSubmit()}
          loading={save.isPending}
        />
        {editingId ? <TextButton label="Cancel editing" onPress={cancel} /> : null}
      </EditorCard>
    </FormScreen>
  );
}
