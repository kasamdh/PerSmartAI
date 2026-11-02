import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { DateTimeField } from '@/components/date-time-field';
import { FormScreen } from '@/components/form-screen';
import { ErrorView, LoadingView } from '@/components/query-states';
import { TextField } from '@/components/text-field';
import { useOwnerVisit } from '@/features/owner/hooks';
import { utcToLocal } from '@/features/scheduling';
import { useOrgSettings } from '@/features/scheduling/hooks';
import { deviceTimeZone } from '@/lib/time-zone';
import { toDateString } from '@/lib/wall-clock';

import { useOwnerBookings, useRequestScheduleChange } from './hooks';
import { seriesChanges, visitChanges } from './reschedule';
import { DURATIONS } from './schemas';

const lengthOptions = (current: number) =>
  [...new Set([...DURATIONS.map(Number), current])]
    .sort((a, b) => a - b)
    .map((m) => ({ value: String(m), label: `${m} min` }));

/**
 * Owners ask to move one visit, or to change a booking's times from a date on.
 * The business approves (with the sitter's schedule checked) or declines.
 */
export function RescheduleScreen({ bookingId, visitId }: { bookingId: string; visitId?: string }) {
  const org = useOrgSettings();
  const bookings = useOwnerBookings();

  if (org.isPending || bookings.isPending) return <LoadingView />;
  if (org.isError || bookings.isError || !org.data) {
    return (
      <ErrorView
        onRetry={() => {
          void org.refetch();
          void bookings.refetch();
        }}
      />
    );
  }
  const booking = bookings.data.find((b) => b.id === bookingId);
  if (!booking)
    return <ErrorView title="This booking can’t be changed" onRetry={() => bookings.refetch()} />;

  const zoneNote =
    org.data.timeZone !== deviceTimeZone()
      ? `Times are in ${org.data.timeZone.replace(/_/g, ' ')} time.`
      : undefined;

  return visitId ? (
    <MoveVisitForm
      bookingId={bookingId}
      visitId={visitId}
      timeZone={org.data.timeZone}
      zoneNote={zoneNote}
    />
  ) : (
    <ChangeSeriesForm booking={booking} zoneNote={zoneNote} />
  );
}

function MoveVisitForm({
  bookingId,
  visitId,
  timeZone,
  zoneNote,
}: {
  bookingId: string;
  visitId: string;
  timeZone: string;
  zoneNote?: string;
}) {
  const visit = useOwnerVisit(visitId);
  if (visit.isPending) return <LoadingView />;
  if (visit.isError) return <ErrorView onRetry={() => visit.refetch()} />;
  const local = utcToLocal(new Date(visit.data.scheduled_start), timeZone);
  const minutes = Math.round(
    (Date.parse(visit.data.scheduled_end) - Date.parse(visit.data.scheduled_start)) / 60_000,
  );
  return (
    <MoveVisitFields
      bookingId={bookingId}
      visitId={visitId}
      initial={{ date: local.date, time: local.time, minutes }}
      zoneNote={zoneNote}
    />
  );
}

function MoveVisitFields({
  bookingId,
  visitId,
  initial,
  zoneNote,
}: {
  bookingId: string;
  visitId: string;
  initial: { date: string; time: string; minutes: number };
  zoneNote?: string;
}) {
  const router = useRouter();
  const today = useMemo(() => toDateString(new Date()), []);
  const request = useRequestScheduleChange();
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [length, setLength] = useState(String(initial.minutes));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    const result = visitChanges({ date, time, durationMinutes: Number(length) }, initial.minutes);
    if (!result.ok) return setError(result.error);
    if (date === initial.date && time === initial.time && Number(length) === initial.minutes) {
      return setError('Nothing changed yet');
    }
    setError(null);
    request.mutate(
      { bookingId, visitId, changes: result.changes, note },
      {
        onSuccess: () => router.back(),
        onError: (e) => setError(e.message || 'Couldn’t send. Please try again.'),
      },
    );
  };

  return (
    <FormScreen
      title="Move this visit"
      subtitle={['The business will confirm the new time.', zoneNote].filter(Boolean).join(' ')}
      error={error}
    >
      <DateTimeField
        mode="date"
        label="New date"
        value={date}
        minimumDate={today}
        onChange={setDate}
      />
      <DateTimeField mode="time" label="New time" value={time} onChange={setTime} />
      <ChoiceChips
        label="Length"
        options={lengthOptions(initial.minutes)}
        value={length}
        onChange={setLength}
      />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} maxLength={500} />
      <BigButton label="Send request" onPress={onSubmit} loading={request.isPending} />
    </FormScreen>
  );
}

function ChangeSeriesForm({
  booking,
  zoneNote,
}: {
  booking: {
    id: string;
    window_start: string | null;
    window_end: string | null;
    duration_minutes: number | null;
    end_date: string | null;
  };
  zoneNote?: string;
}) {
  const router = useRouter();
  const today = useMemo(() => toDateString(new Date()), []);
  const request = useRequestScheduleChange();
  const current = booking.duration_minutes ?? 30;
  const [fromDate, setFromDate] = useState(today);
  const [windowStart, setWindowStart] = useState(booking.window_start?.slice(0, 5) ?? '09:00');
  const [windowEnd, setWindowEnd] = useState(booking.window_end?.slice(0, 5) ?? '');
  const [length, setLength] = useState(String(current));
  const [endDate, setEndDate] = useState(booking.end_date ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    const result = seriesChanges(
      { windowStart, windowEnd, durationMinutes: Number(length), endDate },
      booking,
    );
    if (!result.ok) return setError(result.error);
    setError(null);
    request.mutate(
      { bookingId: booking.id, fromDate, changes: result.changes, note },
      {
        onSuccess: () => router.back(),
        onError: (e) => setError(e.message || 'Couldn’t send. Please try again.'),
      },
    );
  };

  return (
    <FormScreen
      title="Change times"
      subtitle={['Visits from the date you pick change; earlier ones stay as they are.', zoneNote]
        .filter(Boolean)
        .join(' ')}
      error={error}
    >
      <DateTimeField
        mode="date"
        label="Starting from"
        value={fromDate}
        minimumDate={today}
        onChange={setFromDate}
      />
      <Text style={styles.heading}>New times</Text>
      <DateTimeField
        mode="time"
        label="Earliest arrival"
        value={windowStart}
        onChange={setWindowStart}
      />
      <DateTimeField
        mode="time"
        label="Latest arrival (optional)"
        value={windowEnd}
        onChange={setWindowEnd}
        placeholder="Any time after"
        clearable
      />
      <ChoiceChips
        label="Visit length"
        options={lengthOptions(current)}
        value={length}
        onChange={setLength}
      />
      <DateTimeField
        mode="date"
        label="Until (optional)"
        value={endDate}
        minimumDate={fromDate}
        onChange={setEndDate}
        placeholder="No end date"
        clearable
      />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} maxLength={500} />
      <BigButton label="Send request" onPress={onSubmit} loading={request.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginTop: 8 },
});
