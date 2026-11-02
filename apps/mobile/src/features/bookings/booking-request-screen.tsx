import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { DateTimeField } from '@/components/date-time-field';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { MultiChoiceChips } from '@/components/multi-choice-chips';
import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';
import { TextField } from '@/components/text-field';
import { useOwnHousehold, usePets } from '@/features/pets/hooks';
import { toDateString } from '@/lib/wall-clock';
import { zodResolver } from '@/lib/zod-resolver';

import { useRequestBooking } from './hooks';
import {
  bookingRequestSchema,
  defaultCareTimes,
  defaultTimesFor,
  DURATIONS,
  emptyBookingRequest,
  EVERY_WEEKS,
  MAX_CARE_TIMES,
  toRequestBookingArgs,
  WEEKDAYS,
  type BookingRequestValues,
} from './schemas';
import { bookingRequestErrorMessage } from './status';

const SERVICES = [
  { value: 'drop_in', label: 'Drop-in' },
  { value: 'walk', label: 'Walk' },
  { value: 'overnight', label: 'Overnight' },
  { value: 'multi_day', label: 'Multi-day care' },
] as const;
const REPEAT = [
  { value: 'once', label: 'Just once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Some days' },
] as const;
const EVERY_WEEKS_OPTIONS = EVERY_WEEKS.map((n) => ({
  value: n,
  label: n === '1' ? 'Every week' : `Every ${n} weeks`,
}));
const DURATION_OPTIONS = DURATIONS.map((d) => ({ value: d, label: `${d} min` }));

/** Owner asks the business for visits; an admin assigns a sitter and confirms. */
export function BookingRequestScreen() {
  const router = useRouter();
  const today = useMemo(() => toDateString(new Date()), []);
  const household = useOwnHousehold();
  const pets = usePets();
  const request = useRequestBooking();
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, setValue, getValues } = useForm<BookingRequestValues>({
    resolver: zodResolver(bookingRequestSchema(today)),
    defaultValues: emptyBookingRequest(today),
  });
  const careTimes = useFieldArray({ control, name: 'careTimes' });
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
  const stay = service === 'multi_day';
  const repeats = !overnight && !stay && repeat !== 'once';
  const petOptions = pets.data.map((p) => ({ value: p.id, label: p.name }));

  /** Care times suggested from the chosen pets' feeding and medication times. */
  const suggestCareTimes = () => {
    const chosen = getValues('petIds');
    const list = pets.data.filter((p) => chosen.length === 0 || chosen.includes(p.id));
    careTimes.replace(defaultCareTimes(list));
  };

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
              if (next === 'multi_day' && getValues('careTimes').length === 0) {
                suggestCareTimes();
              }
            }}
          />
        )}
      />

      {overnight || stay ? null : (
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
      {repeats && repeat === 'weekly' ? (
        <>
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
          <Controller
            control={control}
            name="everyWeeks"
            render={({ field }) => (
              <ChoiceChips
                label="Repeat"
                options={EVERY_WEEKS_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </>
      ) : null}

      <Controller
        control={control}
        name="startDate"
        render={({ field, fieldState }) => (
          <DateTimeField
            mode="date"
            label={overnight ? 'First night' : stay ? 'First day' : repeats ? 'Starting' : 'Date'}
            value={field.value}
            onChange={field.onChange}
            minimumDate={today}
            error={fieldState.error?.message}
          />
        )}
      />
      {overnight || stay || repeats ? (
        <Controller
          control={control}
          name="endDate"
          render={({ field, fieldState }) => (
            <DateTimeField
              mode="date"
              label={overnight ? 'Back home on' : stay ? 'Last day' : 'Until (optional)'}
              value={field.value}
              onChange={field.onChange}
              minimumDate={startDate || today}
              placeholder={overnight || stay ? 'Choose' : 'No end date'}
              clearable={!overnight && !stay}
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}
      {repeats ? (
        <FormField
          control={control}
          name="count"
          label="Or stop after this many visits (optional)"
          placeholder="e.g. 10"
          keyboardType="number-pad"
        />
      ) : null}

      {stay ? (
        <View style={styles.careTimes}>
          <Text style={styles.heading}>Care each day</Text>
          <Text style={styles.hint}>A sitter visits at each of these times.</Text>
          {careTimes.fields.map((item, index) => (
            <View key={item.id} style={styles.careTime}>
              <Controller
                control={control}
                name={`careTimes.${index}.time`}
                render={({ field }) => (
                  <DateTimeField
                    mode="time"
                    label="Time"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name={`careTimes.${index}.label`}
                render={({ field }) => (
                  <TextField
                    label="What to do"
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder="e.g. Feed and walk"
                    maxLength={80}
                  />
                )}
              />
              <Controller
                control={control}
                name={`careTimes.${index}.durationMinutes`}
                render={({ field }) => (
                  <ChoiceChips
                    label="Length"
                    options={DURATION_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove care time ${index + 1}`}
                onPress={() => careTimes.remove(index)}
                style={styles.remove}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <Controller
            control={control}
            name="careTimes"
            render={({ fieldState }) =>
              fieldState.error?.message ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {fieldState.error.message}
                </Text>
              ) : (
                <></>
              )
            }
          />
          {careTimes.fields.length < MAX_CARE_TIMES ? (
            <BigButton
              label="Add a care time"
              variant="secondary"
              onPress={() => careTimes.append({ time: '12:00', label: '', durationMinutes: '30' })}
            />
          ) : null}
          <BigButton
            label="Suggest from my pets’ routines"
            variant="secondary"
            onPress={suggestCareTimes}
          />
        </View>
      ) : (
        <>
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
        </>
      )}
      {overnight || stay ? null : (
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
  hint: { fontSize: 15, color: '#555555' },
  careTimes: { gap: 10 },
  careTime: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FAFAFA',
  },
  remove: { minHeight: MIN_TAP_TARGET, justifyContent: 'center', alignSelf: 'flex-start' },
  removeText: { fontSize: 16, fontWeight: '600', color: '#C62828' },
  error: { fontSize: 16, color: '#C62828' },
  multiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
});
