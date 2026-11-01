import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';

import { describeSchedule } from '@/features/bookings/booking-text';
import { schedulingErrorText } from '@/features/scheduling/api';

import { useBooking, useConfirmBooking, useDeclineBooking, useSitters } from './hooks';

const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;

function errorAlert(title: string) {
  return (error: Error) => Alert.alert(title, schedulingErrorText(error));
}

/** Lets an admin pick a sitter and confirm (generating visits), or decline. */
export function BookingReviewScreen({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const booking = useBooking(bookingId);
  const sitters = useSitters();
  const confirm = useConfirmBooking();
  const decline = useDeclineBooking();
  const [sitterId, setSitterId] = useState<string | null>(null);

  if (booking.isPending || sitters.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Loading booking" />
      </View>
    );
  }
  if (booking.isError || sitters.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{"Couldn't load this booking"}</Text>
        <BigButton
          label="Try again"
          onPress={() => {
            void booking.refetch();
            void sitters.refetch();
          }}
        />
      </View>
    );
  }

  const b = booking.data;
  const pets = b.booking_pets.flatMap((bp) =>
    bp.pet ? [`${bp.pet.name} (${bp.pet.species})`] : [],
  );
  const place = b.household.name ?? b.household.address_line1;
  const chosen = sitters.data.find((s) => s.id === sitterId) ?? null;
  const pending = b.status === 'requested';
  const busy = confirm.isPending || decline.isPending;

  const onConfirm = () => {
    if (!chosen) return;
    confirm.mutate(
      { bookingId: b.id, sitterId: chosen.id },
      {
        onSuccess: (created) => {
          Alert.alert(
            'Booking confirmed',
            `${chosen.full_name} is assigned. ${created} visit${created === 1 ? '' : 's'} scheduled.`,
          );
          router.back();
        },
        onError: errorAlert("Couldn't confirm the booking"),
      },
    );
  };

  const onDecline = () =>
    Alert.alert('Decline this request?', `The owner of ${place} will see it as declined.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: () =>
          decline.mutate(b.id, {
            onSuccess: () => router.back(),
            onError: errorAlert("Couldn't decline the request"),
          }),
      },
    ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {SERVICE_LABELS[b.service_type]} · {place}
          </Text>
          <Text style={styles.body}>{describeSchedule(b)}</Text>
          {b.duration_minutes ? (
            <Text style={styles.body}>{b.duration_minutes} minutes</Text>
          ) : null}
          <Text style={styles.body}>Pets: {pets.join(', ') || 'none listed'}</Text>
          <Text style={styles.body}>
            Owner: {b.household.owner?.full_name}
            {b.household.owner?.phone ? ` · ${b.household.owner.phone}` : ''}
          </Text>
          {b.notes ? <Text style={styles.notes}>“{b.notes}”</Text> : null}
          {!pending ? <Text style={styles.warning}>This booking is {b.status}.</Text> : null}
        </View>

        {pending ? (
          <View style={styles.card}>
            <Text style={styles.title}>Choose a sitter</Text>
            {sitters.data.length === 0 ? (
              <Text style={styles.body}>No sitters in your business yet.</Text>
            ) : (
              sitters.data.map((s) => {
                const selected = s.id === sitterId;
                return (
                  <Pressable
                    key={s.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={s.full_name}
                    onPress={() => setSitterId(s.id)}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]} />
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {s.full_name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>

      {pending ? (
        <View style={styles.footer}>
          <BigButton
            label={
              chosen ? `Confirm with ${chosen.full_name.split(' ')[0]}` : 'Pick a sitter to confirm'
            }
            onPress={onConfirm}
            disabled={!chosen || busy}
            loading={confirm.isPending}
          />
          <BigButton
            label="Decline request"
            variant="secondary"
            onPress={onDecline}
            disabled={busy}
            loading={decline.isPending}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  body: {
    fontSize: 17,
    color: '#333333',
  },
  notes: {
    fontSize: 17,
    fontStyle: 'italic',
    color: '#444444',
  },
  warning: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B71C1C',
  },
  option: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E3E3E3',
  },
  optionSelected: {
    borderColor: '#208AEF',
    backgroundColor: '#E3F0FD',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#8A8A8A',
  },
  radioSelected: {
    borderColor: '#208AEF',
    backgroundColor: '#208AEF',
  },
  optionLabel: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  optionLabelSelected: {
    fontWeight: '700',
    color: '#0B5CAD',
  },
  footer: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
  },
});
