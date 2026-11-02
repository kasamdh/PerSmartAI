import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { DateTimeField } from '@/components/date-time-field';
import { ErrorView, LoadingView } from '@/components/query-states';
import { utcToLocal } from '@/features/scheduling';
import { schedulingErrorText, SchedulingError } from '@/features/scheduling/api';
import { useOrgSettings } from '@/features/scheduling/hooks';
import { formatDayAndTime, formatTimeRange } from '@/features/visits/time';
import { statusLabel } from '@/features/visits/visit-actions';
import { deviceTimeZone } from '@/lib/time-zone';
import { toDateString } from '@/lib/wall-clock';

import { useSitters } from './hooks';
import type { ScheduleVisit } from './schedule-api';
import { useScheduleVisit, useUpdateVisitSchedule } from './schedule-hooks';

const SERVICE_LABELS = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
} as const;
const LENGTHS = ['15', '30', '45', '60', '90', '120'];

/** Reassign one visit to another sitter or move it; only this visit changes. */
export function ManageVisitScreen({ visitId }: { visitId: string }) {
  const visit = useScheduleVisit(visitId);
  const org = useOrgSettings();
  const sitters = useSitters();

  if (visit.isPending || org.isPending || sitters.isPending) return <LoadingView />;
  if (visit.isError || org.isError || sitters.isError || !org.data) {
    return (
      <ErrorView
        onRetry={() => {
          void visit.refetch();
          void org.refetch();
          void sitters.refetch();
        }}
      />
    );
  }
  return (
    <ManageVisitForm
      key={`${visit.data.scheduled_start}-${visit.data.sitter_id}`}
      visit={visit.data}
      timeZone={org.data.timeZone}
      sitters={sitters.data}
    />
  );
}

function ManageVisitForm({
  visit,
  timeZone,
  sitters,
}: {
  visit: ScheduleVisit;
  timeZone: string;
  sitters: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const update = useUpdateVisitSchedule();
  const local = utcToLocal(new Date(visit.scheduled_start), timeZone);
  const minutes = Math.round(
    (Date.parse(visit.scheduled_end) - Date.parse(visit.scheduled_start)) / 60_000,
  );
  const [sitterId, setSitterId] = useState(visit.sitter_id);
  const [date, setDate] = useState(local.date);
  const [time, setTime] = useState(local.time);
  const [length, setLength] = useState(String(minutes));
  const [reasons, setReasons] = useState<string[]>([]);
  const editable = visit.status === 'scheduled';
  const place = visit.booking.household.name ?? visit.booking.household.address_line1;
  const moved = date !== local.date || time !== local.time || Number(length) !== minutes;
  const reassigned = sitterId !== visit.sitter_id;
  const zoneNote = timeZone !== deviceTimeZone() ? ` (${timeZone.replace(/_/g, ' ')} time)` : '';

  const save = () => {
    if (!sitterId && !moved) return;
    setReasons([]);
    update.mutate(
      {
        visitId: visit.id,
        sitterId: reassigned && sitterId ? sitterId : undefined,
        ...(moved ? { date, time, durationMinutes: Number(length) } : {}),
      },
      {
        onSuccess: ({ problems }) => {
          const warnings = problems.flatMap((p) => p.reasons);
          Alert.alert(
            'Visit updated',
            warnings.length ? `Note: ${warnings.join('; ')}` : undefined,
          );
          router.back();
        },
        onError: (error) => {
          if (error instanceof SchedulingError && error.problems.length) {
            setReasons(error.problems.flatMap((p) => p.reasons));
          } else {
            Alert.alert('Couldn’t update the visit', schedulingErrorText(error));
          }
        },
      },
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {SERVICE_LABELS[visit.booking.service_type]} · {place}
          </Text>
          <Text style={styles.body}>
            {formatDayAndTime(visit.scheduled_start, new Date())} (
            {formatTimeRange(visit.scheduled_start, visit.scheduled_end)})
          </Text>
          <Text style={styles.body}>
            {visit.booking.booking_pets
              .map((bp) => bp.pet?.name)
              .filter(Boolean)
              .join(', ')}
          </Text>
          <Text style={styles.body}>
            {statusLabel(visit.status)} · {visit.sitter?.full_name ?? 'No sitter yet'}
          </Text>
          {visit.late_cancellation ? (
            <Text style={styles.warn}>Cancelled late (inside the cutoff)</Text>
          ) : null}
          <BigButton
            label="Live visit view"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/visit-overview/[id]', params: { id: visit.id } })
            }
          />
        </View>

        {editable ? (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>Sitter</Text>
              {sitters.map((s) => {
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
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {s.full_name}
                      {s.id === visit.sitter_id ? ' (current)' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>When{zoneNote}</Text>
              <Text style={styles.body}>Only this visit moves; the rest of the series stays.</Text>
              <DateTimeField
                mode="date"
                label="Date"
                value={date}
                minimumDate={toDateString(new Date())}
                onChange={setDate}
              />
              <DateTimeField mode="time" label="Start" value={time} onChange={setTime} />
              <ChoiceChips
                label="Length"
                options={[...new Set([...LENGTHS, String(minutes)])]
                  .sort((a, b) => Number(a) - Number(b))
                  .map((m) => ({ value: m, label: `${m} min` }))}
                value={length}
                onChange={setLength}
              />
            </View>

            {reasons.length ? (
              <View style={[styles.card, styles.problems]} accessibilityRole="alert">
                <Text style={styles.title}>Can’t save this</Text>
                {reasons.map((r) => (
                  <Text key={r} style={styles.body}>
                    • {r}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.body}>Only scheduled visits can be changed.</Text>
        )}
      </ScrollView>
      {editable ? (
        <View style={styles.footer}>
          <BigButton
            label={
              reassigned && moved
                ? 'Reassign and move'
                : reassigned
                  ? 'Reassign visit'
                  : moved
                    ? 'Move visit'
                    : 'No changes'
            }
            disabled={!reassigned && !moved}
            loading={update.isPending}
            onPress={save}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 8,
  },
  problems: { borderColor: '#C62828', borderWidth: 2 },
  title: { fontSize: 19, fontWeight: '700', color: '#1A1A1A' },
  body: { fontSize: 16, color: '#333333' },
  warn: { fontSize: 16, fontWeight: '600', color: '#B71C1C' },
  option: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D6D6D6',
    paddingHorizontal: 14,
  },
  optionSelected: { borderColor: '#1565C0', backgroundColor: '#E8F3FE' },
  optionLabel: { fontSize: 17, color: '#1A1A1A' },
  optionLabelSelected: { fontWeight: '700', color: '#0B5CAD' },
  footer: { padding: 16, paddingTop: 8 },
});
