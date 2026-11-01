import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { useAuth } from '@/features/auth/auth-provider';
import { AllergyBanner } from '@/features/pets/allergy-banner';
import { petRouteFor } from '@/features/pets/routes';
import { useOrgTimeZone } from '@/features/scheduling/hooks';
import { setStatusLine } from '@/features/visits/api';
import { CheckOutSheet } from '@/features/visits/check-out-sheet';
import { formatTime, formatTimeRange } from '@/features/visits/time';
import { useVisitActionRunner } from '@/features/visits/use-sitter-visits';
import { primaryActionFor, statusLabel } from '@/features/visits/visit-actions';
import type { Json } from '@/types/database';

import type { VisitPet } from './api';
import {
  canLogCare,
  finishWalkValue,
  ongoingWalk,
  type CareEventType,
  type FedAmount,
} from './care-events';
import { CareTimeline } from './care-timeline';
import { buildChecklist, type ChecklistTask } from './checklist';
import {
  useCareEvents,
  useDeleteCareEvent,
  useIncidents,
  useLogCareEvent,
  useReportIncident,
  useSitterVisitLiveUpdates,
  useUpdateCareEvent,
  useUploadVisitPhoto,
  useVisitDetail,
  useVisitPhotos,
  visitKeys,
} from './hooks';
import { IncidentSheet, type IncidentInput } from './incident-sheet';
import { PetCarePanel, type SimpleCare } from './pet-care-panel';
import { PhotoGrid } from './photo-grid';
import { StatusLineEditor } from './status-line-editor';
import { UndoBar } from './undo-bar';

function showError(title: string) {
  return (error: Error) => Alert.alert(title, error.message || 'Please try again.');
}

const SIMPLE_MESSAGES: Record<SimpleCare, (name: string) => string> = {
  water: (n) => `Fresh water for ${n}`,
  pee: (n) => `${n} peed`,
  poop: (n) => `${n} pooped`,
  play: (n) => `Played with ${n}`,
  vomit: (n) => `${n} vomited`,
};

/** Ticks every second while a walk timer is showing. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function VisitDetailScreen({ visitId }: { visitId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const timeZone = useOrgTimeZone();
  const detail = useVisitDetail(visitId);
  const events = useCareEvents(visitId);
  const photos = useVisitPhotos(visitId);
  const incidents = useIncidents(visitId);
  const logEvent = useLogCareEvent(visitId);
  const removeEvent = useDeleteCareEvent(visitId);
  const updateEvent = useUpdateCareEvent(visitId);
  const uploadPhoto = useUploadVisitPhoto(visitId);
  const report = useReportIncident(visitId);
  const statusLine = useMutation({
    mutationFn: (text: string) => setStatusLine(visitId, text),
    onSettled: () => queryClient.invalidateQueries({ queryKey: visitKeys.detail(visitId) }),
  });
  useSitterVisitLiveUpdates(visitId);

  const [undo, setUndo] = useState<{ id: string; message: string } | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [reporting, setReporting] = useState(false);
  const dismissUndo = useCallback(() => setUndo(null), []);

  const eventList = useMemo(
    () => (events.data ?? []).map((e) => ({ ...e, pet_id: e.pet_id ?? e.pet?.id ?? null })),
    [events.data],
  );
  const walking = eventList.some(
    (e) => e.type === 'walk' && e.pet_id && ongoingWalk([e], e.pet_id) !== null,
  );
  const now = useNow(walking);

  const visit = detail.data;
  const pets = useMemo(
    () => (visit?.booking.booking_pets ?? []).map((bp) => bp.pet).filter((p) => p !== null),
    [visit],
  );
  const checklist = useMemo(
    () => (visit ? buildChecklist(visit, pets, timeZone, eventList) : null),
    [visit, pets, timeZone, eventList],
  );

  const { run, pendingFor, checkOut } = useVisitActionRunner({
    onCheckOut: () => void beginCheckOut(),
  });

  if (detail.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Loading visit" />
      </View>
    );
  }
  if (detail.isError || !visit || !checklist) {
    return (
      <View style={styles.center}>
        <Text style={styles.sectionTitle}>{"Couldn't load this visit"}</Text>
        <BigButton label="Try again" onPress={() => detail.refetch()} />
      </View>
    );
  }

  const household = visit.booking.household;
  // One row per household (unique), but PostgREST returns it as a list via the composite FK.
  const access = household.household_access[0] ?? null;
  const placeName = household.name ?? household.address_line1;
  const loggable = canLogCare(visit.status);
  const open = ['on_the_way', 'arrived', 'in_progress'].includes(visit.status);
  const primary = primaryActionFor(visit.status);
  const allergic = pets.filter((p) => p.pet_allergies.length > 0);

  const log = (pet: VisitPet | null, type: CareEventType, value: Json, message: string) =>
    logEvent.mutate(
      { petId: pet?.id ?? null, type, value },
      {
        onSuccess: (id) => setUndo({ id, message }),
        onError: showError("Couldn't save that"),
      },
    );

  const onFed = (pet: VisitPet, amount: FedAmount, task: ChecklistTask | null) =>
    log(
      pet,
      'fed',
      { amount_eaten: amount, ...(task ? { task_key: task.key } : {}) },
      amount === 'none' ? `${pet.name} didn’t eat` : `Fed ${pet.name} (ate ${amount})`,
    );

  const onMeds = (pet: VisitPet, task: ChecklistTask | null, skipReason?: string) =>
    log(
      pet,
      'meds_given',
      {
        ...(task ? { task_key: task.key, medication_name: task.medicationName } : {}),
        ...(skipReason ? { skipped: true, reason: skipReason } : {}),
      },
      skipReason
        ? `Skipped ${task?.medicationName ?? 'medication'} for ${pet.name}`
        : `${pet.name} got ${task?.medicationName ?? 'their meds'}`,
    );

  const onWalk = (pet: VisitPet) => {
    const walk = ongoingWalk(eventList, pet.id);
    if (walk) {
      updateEvent.mutate(
        { id: walk.id, value: finishWalkValue(walk.value, new Date()) },
        { onError: showError("Couldn't stop the walk") },
      );
      statusLine.mutate(`Back from a walk with ${pet.name}`);
      return;
    }
    log(pet, 'walk', { started_at: new Date().toISOString() }, `Walk with ${pet.name} started`);
    statusLine.mutate(`Out on a walk with ${pet.name}`);
  };

  async function beginCheckOut() {
    if (!checklist || !visit) return;
    if (checklist.outstandingMeds.length > 0) {
      Alert.alert(
        'Finish the medications first',
        `Mark each one given, or skip it with a reason:\n\n${checklist.outstandingMeds
          .map((t) => `• ${pets.find((p) => p.id === t.petId)?.name}: ${t.title}`)
          .join('\n')}`,
      );
      return;
    }
    // Walks still running end at check-out.
    const running = pets.map((p) => ongoingWalk(eventList, p.id)).filter((w) => w !== null);
    try {
      await Promise.all(
        running.map((w) =>
          updateEvent.mutateAsync({ id: w.id, value: finishWalkValue(w.value, new Date()) }),
        ),
      );
    } catch (error) {
      showError("Couldn't stop the walk")(error as Error);
      return;
    }
    setCheckingOut(true);
  }

  const addPhoto = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera access needed',
          'Allow camera access in Settings to take visit photos.',
        );
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    uploadPhoto.mutate(
      {
        organizationId: visit.organization_id,
        petId: pets.length === 1 ? pets[0].id : null,
        uri: asset.uri,
        width: asset.width,
      },
      { onError: showError("Couldn't upload the photo") },
    );
  };

  const sendIncident = (input: IncidentInput) =>
    report.mutate(
      { ...input, organizationId: visit.organization_id },
      {
        onSuccess: () => {
          setReporting(false);
          Alert.alert('Incident reported', 'The business and the owner have been notified.');
        },
        onError: showError("Couldn't send the report"),
      },
    );

  const runnable = {
    id: visit.id,
    placeName,
    home: { lat: household.lat, lng: household.lng, address: household.address_line1 },
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <CheckOutSheet
        placeName={checkingOut ? placeName : null}
        onCancel={() => setCheckingOut(false)}
        onConfirm={(summary) => {
          setCheckingOut(false);
          void checkOut(visit.id, summary, () => {
            Alert.alert('Checked out', 'The report card is on its way to the owner.');
            router.back();
          });
        }}
      />
      <IncidentSheet
        visible={reporting}
        pets={pets.map((p) => ({ id: p.id, name: p.name }))}
        saving={report.isPending}
        onCancel={() => setReporting(false)}
        onSubmit={sendIncident}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {allergic.map((p) => (
          <View key={p.id} style={styles.allergy}>
            <AllergyBanner allergies={p.pet_allergies} />
            <Text style={styles.allergyPet}>{p.name}</Text>
          </View>
        ))}

        {access ? (
          <View style={[styles.card, styles.access]}>
            <Text style={styles.sectionTitle}>Getting in</Text>
            {access.entry_instructions ? (
              <Text style={styles.body}>{access.entry_instructions}</Text>
            ) : null}
            {access.alarm_notes ? (
              <Text style={styles.body}>Alarm: {access.alarm_notes}</Text>
            ) : null}
            {access.wifi_name ? (
              <Text style={styles.body}>
                Wi-Fi: {access.wifi_name}
                {access.wifi_password ? ` / ${access.wifi_password}` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.time}>
            {formatTimeRange(visit.scheduled_start, visit.scheduled_end)} ·{' '}
            {statusLabel(visit.status)}
          </Text>
          <Text style={styles.place}>{placeName}</Text>
          <Text style={styles.body}>
            {[household.address_line1, household.address_line2, household.city]
              .filter(Boolean)
              .join(', ')}
          </Text>
          {visit.check_in_at ? (
            <Text style={styles.body}>
              Checked in {formatTime(visit.check_in_at)}
              {visit.check_out_at ? ` · out ${formatTime(visit.check_out_at)}` : ''}
            </Text>
          ) : null}
          {visit.booking.notes ? <Text style={styles.body}>{visit.booking.notes}</Text> : null}
        </View>

        {loggable ? (
          <View style={styles.card}>
            <StatusLineEditor
              value={visit.status_line}
              saving={statusLine.isPending}
              onSave={(text) =>
                statusLine.mutate(text, { onError: showError("Couldn't update the status") })
              }
            />
          </View>
        ) : null}

        {!loggable && visit.status !== 'completed' ? (
          <Text style={styles.hint}>
            {visit.status === 'scheduled' ? 'Start the trip, then check in' : 'Check in'} to start
            logging care.
          </Text>
        ) : null}

        {pets.map((pet) => (
          <PetCarePanel
            key={pet.id}
            pet={pet}
            tasks={checklist.pets.find((p) => p.petId === pet.id)?.tasks ?? []}
            walk={(() => {
              const w = ongoingWalk(eventList, pet.id);
              const started =
                w?.value && typeof w.value === 'object' && !Array.isArray(w.value)
                  ? w.value.started_at
                  : null;
              return typeof started === 'string' ? { startedAt: started } : null;
            })()}
            now={now}
            enabled={loggable}
            busy={logEvent.isPending || updateEvent.isPending}
            onFed={(amount, task) => onFed(pet, amount, task)}
            onMeds={(task, reason) => onMeds(pet, task, reason)}
            onLog={(type) => log(pet, type, {}, SIMPLE_MESSAGES[type](pet.name))}
            onWalk={() => onWalk(pet)}
            onNote={(text) =>
              log(pet, 'note', { text: text.trim() }, `Note about ${pet.name} saved`)
            }
            onOpenProfile={() => router.push(petRouteFor('sitter', pet.id))}
          />
        ))}

        {open ? (
          <BigButton
            label="Report incident"
            variant="secondary"
            onPress={() => setReporting(true)}
          />
        ) : null}
        {(incidents.data ?? []).map((i) => (
          <View key={i.id} style={[styles.card, styles.incident]}>
            <Text style={styles.incidentTitle}>
              Incident · {i.severity}
              {i.pet ? ` · ${i.pet.name}` : ''} · {formatTime(i.created_at)}
            </Text>
            <Text style={styles.body}>{i.description}</Text>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <PhotoGrid photos={photos.data} isLoading={photos.isPending} />
          {loggable ? (
            <View style={styles.actions}>
              <BigButton
                label="Take photo"
                onPress={() => void addPhoto('camera')}
                loading={uploadPhoto.isPending}
              />
              <BigButton
                label="Choose from library"
                variant="secondary"
                onPress={() => void addPhoto('library')}
                disabled={uploadPhoto.isPending}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Care log</Text>
          <CareTimeline
            events={events.data ?? []}
            canRemove={(e) => loggable && e.created_by === session?.user.id}
            onRemove={(e) =>
              removeEvent.mutate(e.id, { onError: showError("Couldn't remove that entry") })
            }
          />
        </View>
      </ScrollView>

      <UndoBar
        message={undo?.message ?? null}
        onDismiss={dismissUndo}
        onUndo={() => {
          if (undo) removeEvent.mutate(undo.id, { onError: showError("Couldn't undo that") });
          setUndo(null);
        }}
      />
      {primary ? (
        <View style={styles.footer}>
          <BigButton
            label={primary.label}
            onPress={() => void run(runnable, primary.kind)}
            loading={pendingFor(visit.id) === primary.kind}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  allergy: { gap: 2 },
  allergyPet: { fontSize: 14, fontWeight: '600', color: '#B42318', paddingHorizontal: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 6,
  },
  access: { borderColor: '#F0A202', borderWidth: 2 },
  incident: { borderColor: '#C62828', borderWidth: 2 },
  incidentTitle: { fontSize: 17, fontWeight: '700', color: '#B71C1C' },
  time: { fontSize: 17, fontWeight: '600', color: '#0B5CAD' },
  place: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  body: { fontSize: 16, color: '#333333' },
  hint: { fontSize: 17, color: '#555555', textAlign: 'center', paddingVertical: 4 },
  actions: { gap: 10, marginTop: 8 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 16 : 4,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
  },
});
