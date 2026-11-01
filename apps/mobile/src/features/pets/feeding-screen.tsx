import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { ErrorView, LoadingView } from '@/components/query-states';
import { zodResolver } from '@/lib/zod-resolver';

import { usePet, useSaveFeedingPlan } from './hooks';
import { normalizeTimes } from './logic';
import { FOOD_UNITS, feedingSchema, type FeedingFormValues } from './schemas';
import { TimesField } from './times-field';

const UNIT_OPTIONS = FOOD_UNITS.map((u) => ({ value: u, label: u }));
const TREATS = [
  { value: 'yes', label: 'Treats OK' },
  { value: 'no', label: 'No treats' },
] as const;

/** The pet's feeding plan (one plan per pet in the app). */
export function FeedingScreen({ petId }: { petId: string }) {
  const router = useRouter();
  const pet = usePet(petId);
  const save = useSaveFeedingPlan(petId);
  const [formError, setFormError] = useState<string | null>(null);
  const plan = pet.data?.feeding_plans[0];

  const { control, handleSubmit } = useForm<FeedingFormValues>({
    resolver: zodResolver(feedingSchema),
    values: {
      foodBrand: plan?.food_brand ?? '',
      amount: plan?.amount != null ? String(plan.amount) : '',
      unit: (FOOD_UNITS as readonly string[]).includes(plan?.unit ?? '')
        ? (plan!.unit as FeedingFormValues['unit'])
        : 'cup',
      times: normalizeTimes(plan?.times ?? []),
      treatsAllowed: plan?.treats_allowed ?? true,
      notes: plan?.notes ?? '',
    },
  });

  if (pet.isPending) return <LoadingView />;
  if (pet.isError || !pet.data) return <ErrorView onRetry={() => void pet.refetch()} />;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    save.mutate(
      { values, id: plan?.id },
      {
        onSuccess: () => router.back(),
        onError: () => setFormError("Couldn't save. Check your connection and try again."),
      },
    );
  });

  return (
    <FormScreen title={`${pet.data.name}’s food`} error={formError}>
      <FormField
        control={control}
        name="foodBrand"
        label="Food brand"
        placeholder="e.g. Purina Pro Plan Salmon"
      />
      <FormField
        control={control}
        name="amount"
        label="Amount per meal"
        keyboardType="decimal-pad"
        placeholder="e.g. 1.5"
      />
      <Controller
        control={control}
        name="unit"
        render={({ field }) => (
          <ChoiceChips
            label="Unit"
            options={UNIT_OPTIONS}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="times"
        render={({ field, fieldState }) => (
          <TimesField
            label="Meal times"
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="treatsAllowed"
        render={({ field }) => (
          <ChoiceChips
            label="Treats"
            options={TREATS}
            value={field.value ? 'yes' : 'no'}
            onChange={(v) => field.onChange(v === 'yes')}
          />
        )}
      />
      <FormField
        control={control}
        name="notes"
        label="Notes (optional)"
        placeholder="e.g. Mix meds into the evening meal; refill water fountain"
        multiline
      />
      <BigButton label="Save feeding plan" onPress={() => onSubmit()} loading={save.isPending} />
    </FormScreen>
  );
}
