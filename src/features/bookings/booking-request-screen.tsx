import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { DateTimeField } from '@/components/date-time-field';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { MultiChoiceChips } from '@/components/multi-choice-chips';
import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';
import { useOwnHousehold, usePets } from '@/features/pets/hooks';
import { toDateString } from '@/lib/wall-clock';
import { zodResolver } from '@/lib/zod-resolver';

import { useRequestBooking } from './hooks';
import {
  bookingRequestSchema,
  defaultTimesFor,
  DURATIONS,
  emptyBookingRequest,
  toRequestBookingArgs,
  WEEKDAYS,
  type BookingRequestValues,
} from './schemas';
import { bookingRequestErrorMessage } from './status';

const SERVICES = [
  { value: 'drop_in', label: 'Drop-in' },
  { value: 'walk', label: 'Walk' },
  { value: 'overnight', label: 'Overnight' },
] as const;
const REPEAT = [
  { value: 'once', label: 'Just once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Some days' },
] as const;
const DURATION_OPTIONS = DURATIONS.map((d) => ({ value: d, label: `${d} min` }));

/** Owner asks the business for visits; an admin assigns a sitter and confirms. */
export function BookingRequestScreen() {
  const router = useRouter();
  const today = useMemo(() => toDateString(new Date()), []);
  const household = useOwnHousehold();
  const pets = usePets();
  const request = useRequestBooking();
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, setValue } = useForm<BookingRequestValues>({
    resolver: zodResolver(bookingRequestSchema(today)),
    defaultValues: emptyBookingRequest(today),
  });
  const service = useWatch({ control, name: 'service' });
  const repeat = useWatch({ control, name: 'repeat' });
  const startDate = useWatch({ control, name: 'startDate' });

  if (household.isPending || pets.isPending) return <LoadingView />;
  if (household.isError || pets.isError) {
    return (
      <ErrorView
        onRetry={() => {
          void household.refetch();
          void pets.refetch();
        }}
      />
    );
  }
  if (!household.data) {
    return (
      <ErrorView title="Add your home address first" onRetry={() => router.replace('/household')} />
    );
  }
  if (pets.data.length === 0) {
    return (
      <FormScreen title="Book a visit">
        <EmptyView title="Add a pet first" body="Then you can book visits for them." />
        <BigButton label="Add a pet" onPress={() => router.replace('/pets/new')} />
      </FormScreen>
    );
  }

  const overnight = service === 'overnight';
  const petOptions = pets.data.map((p) => ({ value: p.id, label: p.name }));

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    request.mutate(toRequestBookingArgs(values, today), {
      onSuccess: () => router.replace('/my-bookings'),
      onError: (error) => setFormError(bookingRequestErrorMessage(error)),
    });
  });

  return (
    <FormScreen
      title="Book a visit"
      subtitle="We’ll confirm and assign a sitter."
      error={formError}
    >
      <Controller
        control={control}
        name="petIds"
        render={({ field, fieldState }) => (
          <MultiChoiceChips
            label="Which pets?"
            options={petOptions}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="service"
        render={({ field }) => (
          <ChoiceChips
            label="What do you need?"
            options={SERVICES}
            value={field.value}
            onChange={(next) => {
              field.onChange(next);
              const times = defaultTimesFor(next);
              setValue('arrivalStart', times.arrivalStart);
              setValue('arrivalEnd', times.arrivalEnd);
            }}
          />
        )}
      />

      {overnight ? null : (
        <Controller
          control={control}
          name="repeat"
          render={({ field }) => (
            <ChoiceChips
              label="How often?"
              options={REPEAT}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}
      {!overnight && repeat === 'weekly' ? (
        <Controller
          control={control}
          name="days"
          render={({ field, fieldState }) => (
            <MultiChoiceChips
              label="On these days"
              options={WEEKDAYS}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="startDate"
        render={({ field, fieldState }) => (
          <DateTimeField
            mode="date"
            label={overnight ? 'First night' : repeat === 'once' ? 'Date' : 'Starting'}
            value={field.value}
            onChange={field.onChange}
            minimumDate={today}
            error={fieldState.error?.message}
          />
        )}
      />
      {overnight || repeat !== 'once' ? (
        <Controller
          control={control}
          name="endDate"
          render={({ field, fieldState }) => (
            <DateTimeField
              mode="date"
              label={overnight ? 'Back home on' : 'Until (optional)'}
              value={field.value}
              onChange={field.onChange}
              minimumDate={startDate || today}
              placeholder={overnight ? 'Choose' : 'No end date'}
              clearable={!overnight}
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}

      <Text style={styles.heading}>{overnight ? 'Times' : 'Arrival time'}</Text>
      <Controller
        control={control}
        name="arrivalStart"
        render={({ field, fieldState }) => (
          <DateTimeField
            mode="time"
            label={overnight ? 'Sitter arrives (evening)' : 'Earliest arrival'}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="arrivalEnd"
        render={({ field, fieldState }) => (
          <DateTimeField
            mode="time"
            label={overnight ? 'Sitter leaves (morning)' : 'Latest arrival (optional)'}
            value={field.value}
            onChange={field.onChange}
            placeholder={overnight ? 'Choose' : 'Any time after'}
            clearable={!overnight}
            error={fieldState.error?.message}
          />
        )}
      />
      {overnight ? null : (
        <Controller
          control={control}
          name="durationMinutes"
          render={({ field }) => (
            <ChoiceChips
              label="Visit length"
              options={DURATION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}

      <FormField
        control={control}
        name="notes"
        label="Notes for the business (optional)"
        placeholder="e.g. Away for a wedding, back Sunday night"
        multiline
        style={styles.multiline}
      />

      <BigButton label="Send request" onPress={() => onSubmit()} loading={request.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginTop: 8 },
  multiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
});
